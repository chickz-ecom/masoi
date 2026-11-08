# ARCHITECTURE.md

## 1. Tổng quan

```
                 ┌──────────────── VPS (Docker Compose) ────────────────┐
 Browser ──HTTPS─┤ Nginx ── /            ──► web (Next.js, UI only)     │
         ──WSS───┤       ── /api, /socket.io ──► game-server (N instances)│
                 │                               │        │             │
                 │                          PostgreSQL   Redis           │
                 │                       (source of truth) (pub/sub,     │
                 │                                          locks, timers,│
                 │                                          rate limit)  │
                 └──────────────────────────────────────────────────────┘
```

| Thành phần | Công nghệ | Trách nhiệm |
|---|---|---|
| `apps/web` | Next.js 15 App Router, React 19, Tailwind v4, shadcn-style UI, Motion | Giao diện. Không chứa logic luật chơi. Chỉ hiển thị `GameView` server gửi và gửi *ý định* (intent) của người chơi. |
| `apps/game-server` | Node.js, Fastify (REST), Socket.IO, Prisma, ioredis | Server có thẩm quyền: xác thực session, chạy Game Engine, lưu state, hẹn giờ, phân phối event theo người nhận. |
| `packages/engine` | TypeScript thuần, không I/O | Role Engine + Rule Engine + Phase State Machine. Hàm thuần `(state, command, ctx) → (state', events)`. Dùng chung cho cả 2 mode. |
| `packages/shared` | TypeScript + Zod | Hợp đồng dữ liệu: schema payload, kiểu Socket.IO event, DTO REST, mã lỗi, lời dẫn tiếng Việt. Dùng chung client/server. |
| PostgreSQL | Prisma ORM | Nguồn sự thật: room, player, session (hash), game state snapshot có `version`, lịch sử event/action/vote, audit log. |
| Redis | ioredis, `@socket.io/redis-adapter` | Pub/sub giữa các instance, khóa phân tán theo game, hàng đợi timer (ZSET), rate limit. **Không** là nguồn sự thật. |

## 2. Nguyên tắc

1. **Server là nguồn sự thật duy nhất.** Client không bao giờ tính kết quả.
2. **Engine thuần (pure).** Mọi luật nằm trong `packages/engine`, test độc lập với UI, DB, socket. Ngẫu nhiên (`rng`) và thời gian (`now`) được inject.
3. **Hai mode, một engine.** `mode: AUTO | HUMAN` chỉ đổi *chính sách chuyển pha* (`TransitionPolicy`):
   - AUTO: hết giờ / mọi người xong → engine tự chuyển pha; kết quả đêm/phiếu được áp dụng ngay.
   - HUMAN: hết giờ / mọi người xong → chỉ *khóa* hành động; chuyển pha và công bố kết quả cần lệnh quản trò (`MOD_NEXT`, `MOD_CONFIRM` có thể kèm override).
4. **Không lưu state chỉ trong bộ nhớ.** Mỗi lệnh: lấy khóa → đọc state từ Postgres → engine → ghi state với kiểm tra `version` (optimistic concurrency) trong 1 transaction → phát event. Instance chết không làm mất trận.
5. **Projection theo người nhận.** Không broadcast toàn bộ state. Mỗi socket nhận `GameView` được *chiếu* riêng cho mình (`projectView(state, viewer)`): người chơi chỉ thấy vai của mình (+ đồng đội Sói), quản trò thấy toàn bộ. Event private đi qua room Socket.IO riêng `player:<id>`, team room `game:<id>:wolves`, `game:<id>:moderator`.

## 3. Luồng xử lý một lệnh

```
socket.emit('action:submit', payload, ack)
   │  1. rate limit (Redis)            → RATE_LIMITED
   │  2. Zod validate payload          → INVALID_PAYLOAD
   │  3. resolve session → playerId    → UNAUTHORIZED
   ▼
GameService.dispatch(gameId, command)
   │  4. per-game in-process queue (giảm tranh chấp trong 1 instance)
   │  5. Redis lock  ww:lock:game:<id>  (SET NX PX, token, release bằng Lua)
   │  6. load Game.state + version từ Postgres
   │  7. idempotency: clientActionId đã xử lý? → trả ack cũ
   │  8. engine.apply(state, command, { now, rng })  → { state', events } | error
   │  9. TX: UPDATE game SET state, version=version+1 WHERE id AND version=:v
   │         INSERT game_event[], game_action / vote, game_phase (nếu đổi pha)
   │ 10. reschedule timer (Redis ZSET ww:timers  score=deadline member=gameId)
   │ 11. release lock
   ▼
Fan-out: event riêng theo visibility + GAME_STATE_SYNC (projection) cho từng socket trong room
```

## 4. Timer phía server

- Deadline nằm trong state (`phase.endsAt`, `paused.abandonAt`).
- Sau mỗi lệnh, server `ZADD ww:timers <deadline> <gameId>` (hoặc `ZREM` nếu không có deadline).
- Mỗi instance chạy vòng quét 250ms: `ZRANGEBYSCORE ww:timers -inf now LIMIT 0 20`; instance nào `ZREM` thành công (trả 1) mới được xử lý → không xử lý trùng.
- Gửi lệnh `TICK { phaseId }`; engine bỏ qua nếu `phaseId` đã cũ (idempotent).
- Khi khởi động, server **reconcile**: đọc mọi game `RUNNING/PAUSED` từ Postgres và đặt lại timer. Deadline đã qua sẽ được xử lý ngay.
- Client chỉ hiển thị countdown dựa trên `endsAt` + độ lệch đồng hồ (`serverNow` gửi kèm mỗi sync). Không phụ thuộc timer trình duyệt của host.

## 5. Định danh & phiên

- Guest không cần tài khoản. `POST /api/rooms` hoặc `POST /api/rooms/:code/join` trả về `sessionToken` (32 byte ngẫu nhiên, base64url).
- DB chỉ lưu `SHA-256(token)`. Client lưu token trong `localStorage` theo room code.
- Socket handshake: `auth: { token }`. Nickname **không** bao giờ là định danh.
- Refresh / mất mạng: kết nối lại với token → nhận lại đúng `playerId` và `GAME_STATE_SYNC` đầy đủ.

## 6. Mở rộng (scale)

- Game-server stateless (ngoài socket kết nối) → chạy nhiều instance sau Nginx với `ip_hash`/sticky (Socket.IO polling cần sticky) + Redis adapter.
- Mỗi game được khóa riêng nên các room độc lập xử lý song song.
- Postgres: state snapshot JSONB nhỏ (<50KB); event log append-only.

## 7. Cấu trúc repository

```
.
├── apps/
│   ├── web/                 Next.js UI
│   └── game-server/         Fastify + Socket.IO + Prisma
│       └── prisma/          schema.prisma, migrations, seed
├── packages/
│   ├── engine/              Game/Role/Rule engine (pure TS) + tests
│   └── shared/              Zod schemas, socket contracts, narration
├── docs/                    RULES, STATE_MACHINE, DATABASE, SOCKET_EVENTS, ...
├── deploy/nginx/            cấu hình Nginx
├── docker-compose.yml       production stack
├── docker-compose.dev.yml   Postgres + Redis cho dev
└── scripts/                 backup, e2e
```

## 8. Bảo mật (tóm tắt — chi tiết ở `docs/SECURITY.md`)

- Zod validate mọi payload REST/socket; nickname được chuẩn hóa (NFC, trim, 2–20 ký tự, lọc ký tự điều khiển); React tự escape khi render.
- Rate limit theo IP (REST) và theo session (socket) bằng Redis.
- Quyền quản trò kiểm tra bằng `player.kind === MODERATOR` từ DB, không từ payload.
- Log không ghi token, không ghi vai/hành động bí mật ở mức info.
- Room code 6 ký tự từ bảng 31 ký tự không gây nhầm lẫn (`crypto.randomInt`) + rate limit join theo IP.
