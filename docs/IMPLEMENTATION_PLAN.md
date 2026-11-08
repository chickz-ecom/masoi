# IMPLEMENTATION_PLAN.md — Kế hoạch & trạng thái

Cập nhật: 2026-11-08. ✅ xong · 🟡 một phần · ⬜ chưa làm.

## Milestone 1 — Project Foundation ✅
| Hạng mục | Trạng thái | Vị trí |
|---|---|---|
| Monorepo npm workspaces, TS strict, ESLint, Prettier | ✅ | `package.json`, `tsconfig.base.json`, `eslint.config.mjs` |
| Database schema + migration | ✅ | `apps/game-server/prisma` |
| Guest authentication (session token, hash) | ✅ | `rooms/roomService.ts`, `security/tokens.ts` |
| Create / join room (REST), mã phòng, link mời, QR | ✅ | `http/routes.ts`, `web/.../InvitePanel.tsx` |
| Socket.IO + Redis adapter | ✅ | `realtime/socketServer.ts` |
| Lobby (ready, cấu hình, kick, chuyển host) | ✅ | `web/.../Lobby.tsx`, `RoomSettingsPanel.tsx` |

## Milestone 2 — Core Game Engine ✅
| Hạng mục | Trạng thái | Vị trí |
|---|---|---|
| Role definitions (9 vai, khai báo) | ✅ | `packages/engine/src/roles.ts` |
| Rule engine (RuleConfig, deck validation) | ✅ | `config.ts`, `deck.ts` |
| Chia vai bí mật (CSPRNG) | ✅ | `reducer.ts#createGame`, `tokens.ts#cryptoRng` |
| Phase state machine | ✅ | `flow.ts`, `docs/STATE_MACHINE.md` |
| Night/day progression, voting, tie-break, win conditions | ✅ | `night.ts`, `voting.ts`, `win.ts` |
| 71 unit test + mô phỏng 150 trận ngẫu nhiên | ✅ | `packages/engine/test` |

## Milestone 3 — Automatic Moderator ✅
| Hạng mục | Trạng thái |
|---|---|
| Server-side timers (Redis ZSET + khôi phục từ Postgres) | ✅ |
| Tự mở/đóng phase, xử lý timeout, kết thúc sớm khi mọi người xong | ✅ |
| Bước giả cho vai đã chết (không lộ thông tin) | ✅ |
| Pause/abort khi mọi người mất kết nối | ✅ |
| Countdown đồng bộ server (đo độ lệch đồng hồ) | ✅ |
| Lời dẫn tiếng Việt: **VieNeu-TTS** (giọng “Hải Đăng”) → fallback Web Speech → chữ | ✅ |
| Âm thanh chuyển ngày/đêm (tổng hợp WebAudio) | ✅ |

## Milestone 4 — Human Moderator ✅
| Hạng mục | Trạng thái |
|---|---|
| Dashboard: người chơi, vai, sống/chết, phase, action status, tóm tắt đêm, phiếu, timeline | ✅ |
| Start/Pause/Resume/Next/Close voting/Lock/Reopen/±30s/End | ✅ |
| Confirm + override (đêm & phiếu), validate, audit log | ✅ |

## Milestone 5 — Enhanced Roles & UX 🟡
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Cupid, Già Làng, Sói Trắng (engine + UI + test) | ✅ | Gated bởi `enableAdvancedRoles` |
| Animation lật bài, chuyển phase, reduced-motion | ✅ | |
| Âm thanh | 🟡 | Cue tổng hợp; chưa có file audio thiết kế riêng |
| Game history | 🟡 | API `GET /api/me/history` + tổng kết cuối trận; chưa có trang lịch sử riêng |
| Replay/restart | 🟡 | “Chơi lại cùng nhóm” ✅; trình phát lại từng bước ⬜ |
| Hướng dẫn chơi `/huong-dan` + trợ giúp theo ngữ cảnh trong trận | ✅ | |

## Milestone 6 — Production 🟡
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Security hardening | ✅ | `docs/SECURITY.md` |
| Dockerfiles, Compose, Nginx HTTPS/WSS, certbot, backup | ✅ | |
| Healthchecks, graceful shutdown, structured logging | ✅ | |
| CI/CD: GitHub Actions (lint, typecheck, test, e2e) → image GHCR → deploy tự động lên VPS, rollback | ✅ | `docs/CICD.md`, `.github/workflows/` |
| Production dùng chung PostgreSQL/Redis với Kestrel (`workspaces_shared`), backup/restore chỉ database `masoi`, đường quay lại Postgres/Redis riêng | ✅ | `docs/DEPLOY_VPS_SHARED.md`, `deploy/vps-shared/` |
| Chịu được Postgres/Redis chung khởi động lại (chờ khi boot, health có timeout), pool ≤ 10, kênh pub/sub `ww:`, `maintenance.sh` | ✅ | `docs/RUNBOOK_VPS.md` |
| Load testing | ⬜ | Đề xuất: k6/Artillery với socket.io-client |
| Monitoring (metrics, alert) | ⬜ | Đề xuất: Prometheus exporter + Uptime Kuma |

## Visual assets (Mục 10.1) ✅
| Bước | Trạng thái |
|---|---|
| 1. `docs/visual-assets-plan.md` (57 asset) | ✅ |
| 2. `docs/chatgpt-image-prompts.md` (Master prompt + 57 prompt) | ✅ |
| 3. Tạo ảnh bằng ChatGPT (qua Chrome, 1 cuộc trò chuyện “Ready art direction”) | ✅ 57/57 |
| 4. Pipeline tích hợp: manifest, `assets:normalize` (1254→1024, tách nền), `assets:check`, `assets:optimize` (115 WebP, ~9,5MB) | ✅ |
| 5. Visual QA với artwork thật (contact sheet + ảnh chụp Playwright mobile/desktop) | ✅ |

## Kiểm thử
| Bộ test | Lệnh | Số lượng |
|---|---|---|
| Engine unit + property | `npm test -w @masoi/engine` | 71 |
| Shared schemas | `npm test -w @masoi/shared` | 7 |
| Server integration (Postgres + Redis thật) | `npm test -w @masoi/game-server` | 13 |
| E2E multi-client cả 2 mode | `npm run test:e2e` | 2 |
| E2E giao diện (Playwright, 4 trình duyệt) | `npm run test:ui -w @masoi/web` | 3 |

## Bước tiếp theo đề xuất
1. Cân nhắc Git LFS cho 57 file PNG gốc (~110MB) trong `apps/web/public/assets`.
2. Trang lịch sử trận + trình phát lại timeline.
3. Load test 50 phòng × 12 người; thêm metrics.
