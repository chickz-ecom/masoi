# STATE_MACHINE.md

Hai tầng state machine:

1. **Room** (do game-server quản lý, lưu bảng `Room`): `LOBBY → IN_GAME → LOBBY (chơi lại) → CLOSED`.
2. **Game** (do `packages/engine` quản lý, lưu `Game.state`): các pha bên dưới.

## 1. Room

```
          create             host START (deck hợp lệ, mọi người Ready)
 (none) ─────────► LOBBY ─────────────────────────────────────► IN_GAME
                    ▲                                              │
                    │        host/moderator "Chơi lại"             │ GAME_OVER / ABORTED
                    └──────────────────────────────────────────────┘
                    │ mọi người rời + hết hạn
                    ▼
                  CLOSED
```

## 2. Game phases

```
ROLE_REVEAL
   │ (timeout | mọi người xác nhận đã xem vai)
   ▼
NIGHT[step] ──► NIGHT[next step] ──► … ──► (resolve night)
                                             │
                                             ▼
                                           DAWN  (công bố người chết)
                                             │
                     ┌───────────────────────┤ continueAfterDeaths(next = DAY_DISCUSSION)
                     ▼                       │
               HUNTER_SHOT ──(bắn/bỏ)──► continueAfterDeaths
                                             │
                     ┌──── winner? ──────────┤
                     ▼                       ▼
                 GAME_OVER            DAY_DISCUSSION
                                             │ (timeout | mọi người bỏ qua)
                                             ▼
                                         VOTING (round 1)
                                             │ tally
                          ┌── tie & runoff ──┤
                          ▼                  ▼
                   VOTING (round 2) ──► VOTE_RESULT (công bố/loại)
                                             │ continueAfterDeaths(next = NIGHT)
                                             ▼
                             HUNTER_SHOT? → winner? → GAME_OVER | NIGHT (day+1)
```

`continueAfterDeaths(next)`:
1. Nếu `pendingReactions` không rỗng → vào `HUNTER_SHOT` cho phản ứng đầu tiên (`returnTo = next`).
2. Ngược lại → `checkWinner()`; có đội thắng → `GAME_OVER`; không → vào `next`.

## 3. Cấu trúc phase trong state

```ts
interface PhaseBase {
  id: number;            // tăng dần, dùng làm phaseId cho chống hành động cũ
  startedAt: number;     // epoch ms (server)
  endsAt: number | null; // null khi tạm dừng hoặc chờ quản trò
  locked: boolean;       // không nhận thêm hành động
}
type Phase =
  | PhaseBase & { type: 'ROLE_REVEAL'; acks: string[] }
  | PhaseBase & { type: 'NIGHT'; night: number; step: NightStepId; fake: boolean }
  | PhaseBase & { type: 'DAWN'; confirmed: boolean }
  | PhaseBase & { type: 'HUNTER_SHOT'; hunterId: string; returnTo: 'DAY_DISCUSSION' | 'NIGHT'; resolved: boolean }
  | PhaseBase & { type: 'DAY_DISCUSSION'; skipVotes: string[] }
  | PhaseBase & { type: 'VOTING'; round: 1 | 2; candidates: string[] | null; ballots: Record<string, Ballot> }
  | PhaseBase & { type: 'VOTE_RESULT'; confirmed: boolean; tally: Record<string, number>; eliminatedId: string | null }
  | PhaseBase & { type: 'GAME_OVER' };
```

## 4. Lệnh (commands) và pha hợp lệ

| Lệnh | Ai gửi | Pha hợp lệ | Ghi chú |
|---|---|---|---|
| `TICK {phaseId}` | Timer server | mọi pha có `endsAt` | `phaseId` cũ → bỏ qua (no-op) |
| `ACK_ROLE` | participant | `ROLE_REVEAL` | |
| `NIGHT_ACTION {phaseId, action}` | participant còn sống đúng vai | `NIGHT` đúng bước, chưa khóa | Sói được đổi lựa chọn; vai khác 1 lần/đêm |
| `HUNTER_SHOOT {phaseId, targetId?}` | đúng Thợ Săn | `HUNTER_SHOT` | |
| `SKIP_DISCUSSION {phaseId}` | participant còn sống | `DAY_DISCUSSION` | |
| `VOTE {phaseId, targetId?, lock}` | participant còn sống | `VOTING`, chưa khóa | |
| `MOD_NEXT` | quản trò | mọi pha (HUMAN) | Chuyển pha/bước tiếp theo |
| `MOD_PAUSE` / `MOD_RESUME` | quản trò | không phải `GAME_OVER` | |
| `MOD_ADJUST_TIMER {deltaSeconds}` | quản trò | pha có `endsAt` | `endsAt ≥ now + 5s` |
| `MOD_LOCK` / `MOD_REOPEN {seconds}` | quản trò | `NIGHT`, `VOTING`, `HUNTER_SHOT` | Reopen chỉ khi chưa resolve |
| `MOD_CONFIRM {override?}` | quản trò | `DAWN`, `VOTE_RESULT` chưa xác nhận | override được validate, ghi audit log |
| `MOD_END {winner?}` | quản trò | bất kỳ trừ `GAME_OVER` | `winner` thiếu → `ABORTED` |
| `SYS_PAUSE` / `SYS_RESUME` / `SYS_ABORT` | server | — | chính sách mất kết nối |

## 5. Chính sách chuyển pha theo mode

| Sự kiện | AUTO | HUMAN |
|---|---|---|
| Hết giờ một pha | Chuyển pha tự động | `locked = true`, `endsAt = null`, báo quản trò |
| Mọi người đã hành động xong | Chuyển pha tự động | Báo quản trò (`actionStatus` đầy đủ) |
| Kết thúc đêm | Resolve + áp dụng ngay, vào `DAWN (confirmed)` | Resolve → `pendingOutcome`, vào `DAWN (confirmed=false)`, người chơi thấy "Đang chờ quản trò" |
| Kết thúc bỏ phiếu | Tally + loại ngay | Tally → `VOTE_RESULT (confirmed=false)`; quản trò xác nhận / override |
| Thợ Săn bắn | Áp dụng ngay, chuyển tiếp | Áp dụng ngay, đợi `MOD_NEXT` |
| Tất cả mất kết nối | `SYS_PAUSE` (hoặc hủy) | Không đổi (quản trò điều khiển) |

## 6. Bất biến (invariants) — được kiểm tra trong test

- Đúng một pha hiện tại; `phase.id` tăng nghiêm ngặt.
- Người chết không có hành động/phiếu được ghi nhận sau thời điểm chết.
- Mỗi bình của Phù Thủy dùng tối đa 1 lần.
- Bảo Vệ không bảo vệ cùng một người 2 đêm liên tiếp (khi luật mặc định).
- `GAME_OVER` là trạng thái kết thúc: mọi lệnh sau đó bị từ chối (`GAME_OVER`).
- Kiểm tra thắng chỉ xảy ra khi `pendingReactions` rỗng.
