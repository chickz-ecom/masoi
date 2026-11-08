# SOCKET_EVENTS.md — Hợp đồng realtime

Kiểu TypeScript đầy đủ: [`packages/shared/src/contracts.ts`](../packages/shared/src/contracts.ts) · Zod schema: [`packages/shared/src/schemas.ts`](../packages/shared/src/schemas.ts).

## 1. Kết nối

```ts
io(GAME_SERVER_URL, { path: '/socket.io', auth: { token } })
```

- Middleware xác thực token (hash → `PlayerSession`), rate-limit theo IP. Lỗi trả `connect_error` với `err.data.code` ∈ `UNAUTHORIZED | SESSION_REVOKED | ROOM_CLOSED | RATE_LIMITED`.
- Sau khi kết nối, socket tham gia các room Socket.IO:
  - `r:<roomId>` — mọi thành viên (event công khai, trạng thái lobby)
  - `m:<memberId>` — riêng từng người (event riêng tư, projection riêng)
  - `mods:<roomId>` — quản trò (Mode B)
  - `spec:<roomId>` — người xem
- Client gọi `room:sync` sau mỗi lần (re)connect để nhận trạng thái đầy đủ.

## 2. Client → Server (luôn có ack)

Ack: `{ ok: true, data } | { ok: false, error: { code, message } }`. Payload được Zod validate (`.strict()` — trường lạ bị từ chối).

| Event | Payload | Quyền |
|---|---|---|
| `room:sync` | `{}` | thành viên → `{ room: RoomView, game: GameSync \| null }` |
| `room:leave` | `{}` | thành viên |
| `lobby:ready` | `{ ready }` | PLAYER, LOBBY |
| `lobby:updateSettings` | `{ patch: RoomSettingsPatch }` | host, LOBBY |
| `lobby:kick` / `lobby:transferHost` | `{ memberId }` | host, LOBBY |
| `game:start` | `{}` | host → `{ gameId }` |
| `game:ackRole` | `{ phaseId }` | participant |
| `game:nightAction` | `{ phaseId, clientActionId, action }` | participant đúng vai, đúng bước |
| `game:hunterShoot` | `{ phaseId, clientActionId, targetId \| null }` | đúng Thợ Săn |
| `game:skipDiscussion` | `{ phaseId }` | participant còn sống |
| `game:vote` | `{ phaseId, clientActionId, targetId \| null, lock }` | participant còn sống |
| `game:playAgain` | `{}` | host, sau GAME_OVER |
| `mod:command` | `{ clientActionId, command: MOD_* }` | MODERATOR (kiểm tra lại từ DB) |
| `time:ping` | `{ clientTime }` | → `{ serverNow, clientTime }` (đồng bộ đồng hồ) |

`action` (discriminated union theo `kind`): `CUPID_LINK {targetIds:[a,b]}`, `GUARD_PROTECT {targetId|null}`, `WOLF_VOTE {targetId|null}`, `WHITE_WOLF_KILL {targetId|null}`, `SEER_CHECK {targetId}`, `WITCH_ACT {heal, poisonTargetId|null}`.

`command`: `MOD_NEXT`, `MOD_PAUSE`, `MOD_RESUME`, `MOD_ADJUST_TIMER {deltaSeconds}`, `MOD_LOCK`, `MOD_REOPEN {seconds}`, `MOD_CONFIRM {override?, reason?}`, `MOD_END {winner|null, reason?}`.

## 3. Server → Client

| Event | Nội dung | Người nhận |
|---|---|---|
| `room:state` | `RoomView` (đã tính riêng `you`, `canStart`, `deckIssues`) | từng socket trong phòng |
| `game:sync` | **GAME_STATE_SYNC** `{ view: GameView, version, serverNow }` — projection riêng | từng người chơi / quản trò / nhóm người xem |
| `event` | `ServerEvent { id, type, at, payload }` | theo visibility (bên dưới) |
| `session:revoked` | `{ reason }` | người bị kick / rời |

Client bỏ qua `game:sync` có `version` nhỏ hơn bản đang có (an toàn khi nhiều instance phát song song).

### Danh sách `event.type`

| Type | Visibility | Payload chính |
|---|---|---|
| `ROOM_CREATED`, `PLAYER_JOINED`, `PLAYER_LEFT`, `PLAYER_RECONNECTED`, `PLAYER_DISCONNECTED`, `PLAYER_READY`, `PLAYER_KICKED`, `HOST_CHANGED`, `SETTINGS_UPDATED`, `RETURNED_TO_LOBBY` | phòng | memberId, … |
| `GAME_STARTED` | public | players (không vai), deck |
| `ROLE_ASSIGNED` | **riêng người đó** | role, teammates (Sói) |
| `PHASE_CHANGED` | public | phaseId, type, step, night, day, endsAt, round, candidates, hunterId |
| `ROLE_ACTION_REQUESTED` | riêng người được gọi | step, phaseId |
| `ROLE_ACTION_SUBMITTED` | riêng người gửi (+ quản trò) | step, kind |
| `SEER_RESULT` | riêng Tiên Tri | targetId, isWolf |
| `WOLF_VOTES_UPDATED` | riêng các Sói còn sống | votes |
| `LOVERS_LINKED` | riêng từng người yêu | partnerId, partnerRole |
| `NIGHT_RESULT` | public | deaths `[{playerId, role \| null}]` (không nguyên nhân) |
| `NIGHT_SUMMARY` | quản trò | đề xuất chết + chi tiết |
| `HUNTER_SHOT` | public | hunterId, targetId, deaths |
| `DISCUSSION_SKIP_UPDATED` | public | count, total |
| `VOTE_SUBMITTED` | public: chỉ số đếm · quản trò: chi tiết | lockedCount, votedCount, total |
| `VOTING_ENDED` | public | round, tally, outcome, ballots (nếu `revealVotes`) |
| `PLAYER_ELIMINATED` | public | playerId \| null, role, deaths |
| `GAME_ENDED` | public | winner, winnerIds, reveal (toàn bộ vai) |
| `GAME_PAUSED` / `GAME_RESUMED` / `TIMER_ADJUSTED` | public | by, endsAt, locked |
| `TIMER_EXPIRED`, `AWAITING_MODERATOR`, `MODERATOR_OVERRIDE` | quản trò | … |

Ở Mode B, quản trò nhận thêm bản sao của mọi event riêng tư để giám sát.

## 4. Đảm bảo

- **Authoritative state**: client chỉ gửi ý định; kết quả do engine tính.
- **Room isolation**: mọi lệnh lấy `roomId` từ session, không từ payload.
- **Không broadcast-rồi-ẩn**: mỗi người nhận một `GameView` đã cắt theo quyền (`projectView`).
- **Stale actions**: `phaseId` cũ → `STALE_PHASE`.
- **Idempotent**: `clientActionId` (xem DATABASE.md §4).
- **Race**: hàng đợi theo game + khóa Redis + optimistic version.
- **Scale ngang**: `@socket.io/redis-adapter`; timer Redis ZSET pop nguyên tử bằng Lua.
