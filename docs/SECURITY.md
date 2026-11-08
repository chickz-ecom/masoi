# SECURITY.md — Bảo mật & chống gian lận

| Yêu cầu | Cách triển khai | Kiểm chứng |
|---|---|---|
| Server là nguồn sự thật | Engine chạy trên server; client chỉ gửi intent | E2E: kết quả đêm/phiếu chỉ đến từ server |
| Không gửi vai người khác | `projectView()` cắt theo viewer; event riêng gửi tới `m:<id>` | `integration.test.ts` › "each player only ever receives their own role"; `setup.test.ts` › projection |
| Không tin input browser | Zod `.strict()` cho mọi payload REST/socket; engine kiểm tra lại toàn bộ luật | `schemas.test.ts`, `night.test.ts` |
| Session token khó đoán | 32 byte `crypto.randomBytes`, base64url; DB lưu SHA-256 | `integration.test.ts` › "never stores raw session tokens" |
| Nickname không là định danh | Định danh = `memberId` từ session; nickname chỉ hiển thị, duy nhất trong phòng để tránh nhầm | — |
| Chặn submit nhiều lần | `clientActionId` unique + engine `ALREADY_ACTED` | `integration.test.ts` › idempotent |
| Chặn người chết vote/hành động | Engine `PLAYER_DEAD` | `day.test.ts`, E2E |
| Chặn sai phase / phase cũ | `WRONG_PHASE`, `WRONG_STEP`, `STALE_PHASE` | `night.test.ts` |
| Chặn target sai | Hàm `*Targets()` dùng chung cho prompt và validate | `night.test.ts` |
| Chặn giả danh quản trò | `mod:command` kiểm tra `kind=MODERATOR` từ DB + engine yêu cầu actor moderator & mode HUMAN | E2E HUMAN |
| Client không sửa state | Không có API ghi state; mọi thay đổi qua engine | — |
| Rate limiting | REST: `@fastify/rate-limit` (Redis); socket: fixed-window theo member & event; auth theo IP; Nginx `limit_req` | — |
| Escape / sanitize nickname | NFC, bỏ ký tự điều khiển / zero-width / bidi / `<>`; React tự escape | `schemas.test.ts` |
| Không lộ private state qua log | pino redact token; không log vai/hành động ở mức info | review |
| Header bảo mật | Next: `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; Nginx: HSTS | — |
| TTS | `POST /api/tts` cần session, giới hạn 400 ký tự, rate-limit, cache; nội dung là lời dẫn công khai | — |

## Những điểm cần lưu ý khi vận hành

- Giữ `.env.production` ngoài git; mật khẩu Postgres sinh ngẫu nhiên.
- Postgres và Redis **không** mở cổng ra Internet (compose không publish port của chúng).
- Nếu chạy VieNeu trên host với `HOST=0.0.0.0`, đặt `VIENEU_API_KEY` và firewall chặn cổng 8000 từ bên ngoài (`ufw deny 8000`).
- Thông tin bí mật vẫn có thể lộ qua kênh ngoài game (nhìn màn hình, voice chat) — đó là phép lịch sự của người chơi, hướng dẫn chơi có nhắc.
