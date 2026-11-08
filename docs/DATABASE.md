# DATABASE.md

Schema: [`apps/game-server/prisma/schema.prisma`](../apps/game-server/prisma/schema.prisma) · Migration: `apps/game-server/prisma/migrations/`.

## 1. Phân tách khái niệm

| Khái niệm | Bảng | Vòng đời |
|---|---|---|
| **Room** — phòng chờ lâu dài, có mã mời | `Room`, `RoomSettings` | Từ lúc tạo đến khi đóng. Một room chứa nhiều game liên tiếp ("Chơi lại"). |
| **Member** — người trong phòng (player / moderator / spectator) | `Player` | Từ lúc vào đến khi rời / bị kick. Nickname chỉ để hiển thị. |
| **Session** — bằng chứng định danh của guest | `PlayerSession` | Token 256-bit; DB chỉ lưu `SHA-256`. Hết hạn sau `SESSION_TTL_DAYS`, thu hồi khi kick/rời (tùy luật). |
| **Game instance** — một ván | `Game`, `GameParticipant`, `GameRoleAssignment` | Từ `game:start` đến `GAME_OVER`/`ABORTED`. |
| **Lịch sử** | `GamePhase`, `GameAction`, `Vote`, `GameEvent`, `GameResult`, `ModeratorAuditLog` | Append-only, dùng cho xem lại / kiểm toán. |
| **Danh mục vai** | `RoleDefinition` | Đồng bộ từ `packages/engine` mỗi lần server khởi động (upsert). |

## 2. Sơ đồ quan hệ

```
Room 1─1 RoomSettings
Room 1─n Player 1─n PlayerSession
Room 1─n Game 1─n GameParticipant 1─1 GameRoleAssignment n─1 RoleDefinition
                Game 1─n GamePhase | GameAction | Vote | GameEvent | ModeratorAuditLog
                Game 1─1 GameResult
Player 1─n GameParticipant
```

## 3. Nguồn sự thật & versioning

- `Game.state` (JSONB) là **snapshot có thẩm quyền** của engine (`GameState`), kèm `Game.version`.
- Mọi lệnh ghi bằng `UPDATE … WHERE id = :id AND version = :v` (optimistic concurrency) trong **một transaction** cùng với các bảng lịch sử. Không khớp version → đọc lại và thử lại (tối đa 3 lần).
- Ngoài ra lệnh được tuần tự hóa bởi khóa Redis `lock:game:<id>` + hàng đợi trong process → hai hành động xung đột không bao giờ cùng áp dụng lên một version.
- `Game.phaseType`, `phaseId`, `nextDeadline`, `status` là cột phi chuẩn hóa để truy vấn nhanh (vd. khôi phục timer khi khởi động: `WHERE status='RUNNING' AND nextDeadline IS NOT NULL`).
- `GameEvent.seq` tăng dần theo game (`@@unique([gameId, seq])`), dùng làm id event phía client (`<gameId>:<seq>`).

## 4. Idempotency

`GameAction @@unique([gameId, actorPlayerId, clientActionId])`. Trước khi áp dụng, server tra `clientActionId`:
- đã `ACCEPTED` → trả `ok` (duplicate) mà không áp dụng lại;
- đã `REJECTED` → trả lại đúng mã lỗi cũ.

## 5. Chính sách truy cập dữ liệu bí mật

| Dữ liệu | Bí mật? | Ai đọc | Cách rời server |
|---|---|---|---|
| `Game.state` | Có (vai, hành động đêm) | `GameService` | Chỉ qua `projectView(state, viewer)` |
| `GameRoleAssignment` | Có | Không endpoint nào trả trực tiếp | Lật khi `GAME_OVER` qua projection |
| `GameAction` | Có | Chỉ nội bộ (idempotency, kiểm toán) | Không bao giờ |
| `GameEvent` `PRIVATE` / `MODERATOR` | Có | Fan-out tới đúng `recipients` / phòng quản trò | Socket riêng của người nhận |
| `GameEvent` `PUBLIC` | Không | Mọi thành viên phòng | Socket phòng |
| `GameResult.summary` | Không (sau trận) | `GET /api/me/history` (cần session của phòng) | REST |
| `PlayerSession.tokenHash` | Có | `RoomService.authenticate` | Không bao giờ |

Log server không ghi token (pino redact) và không ghi vai/hành động ở mức `info`.

## 6. Bảo trì

- Migration production: service `migrate` trong `docker-compose.yml` chạy `prisma migrate deploy` trước khi game-server khởi động.
- Production dùng chung PostgreSQL 16 của Kestrel: database `masoi`, role `masoi` (không superuser, chủ database) — `docs/DEPLOY_VPS_SHARED.md`.
- Backup: `scripts/backup-db.sh` (`pg_dump -Fc` chỉ database `masoi`, kiểm tra đọc được, giữ 14 bản) · khôi phục: `scripts/restore-db.sh` (một transaction, lỗi → ROLLBACK, sao lưu hiện trạng trước).
- Dọn dẹp (gợi ý cron): xóa `Room` `CLOSED` cũ hơn 30 ngày — cascade xóa toàn bộ dữ liệu liên quan.
