# Ma Sói Online 🐺🌕

Game **Ma Sói (Werewolf)** multiplayer thời gian thực trên web, hai chế độ:

- **Quản trò tự động** — mọi người đều chơi; server chia vai, dẫn truyện (giọng **VieNeu-TTS**), hẹn giờ, xử lý đêm, kiểm phiếu, kiểm tra thắng thua.
- **Có quản trò** — một người điều khiển bằng dashboard: xem toàn bộ vai, chuyển pha, xác nhận / điều chỉnh kết quả (có audit log).

Hai chế độ dùng chung **một Game Engine** thuần TypeScript; chỉ khác chính sách chuyển pha.

| Tài liệu | Nội dung |
|---|---|
| [docs/RULES.md](docs/RULES.md) | Ruleset `classic-v1` — mọi luật & điểm mơ hồ đã chốt |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc, luồng xử lý lệnh, timer, scale |
| [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) | State machine room & game, lệnh hợp lệ theo pha |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, versioning, chính sách truy cập dữ liệu bí mật |
| [docs/SOCKET_EVENTS.md](docs/SOCKET_EVENTS.md) | Hợp đồng Socket.IO |
| [docs/SECURITY.md](docs/SECURITY.md) | Bảo mật & chống gian lận |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Milestone & trạng thái |
| [docs/visual-assets-plan.md](docs/visual-assets-plan.md) · [docs/chatgpt-image-prompts.md](docs/chatgpt-image-prompts.md) | Kế hoạch & prompt tạo hình ảnh bằng ChatGPT |

## Cấu trúc

```
apps/web            Next.js 15 (App Router) · React 19 · Tailwind v4 · Motion — giao diện
apps/game-server    Fastify · Socket.IO · Prisma · ioredis — server có thẩm quyền
packages/engine     Role/Rule engine + phase state machine (pure TS, 71 test)
packages/shared     Zod schema, hợp đồng socket, lời dẫn tiếng Việt
deploy/nginx        Reverse proxy HTTPS/WSS
scripts             Backup / restore DB
```

## Chạy ở máy dev

Yêu cầu: Node ≥ 20.11 (khuyên 22), Docker Desktop.

```bash
npm install
cp .env.example .env          # rồi trỏ DATABASE_URL / REDIS_URL tới Postgres & Redis bạn đang có
npm run dev                   # kiểm tra cổng → migrate → game server (4000) + web (3100)
```

Chưa có Postgres/Redis? `npm run dev:with-infra` sẽ bật chúng bằng `docker-compose.dev.yml` (cổng 55432 / 56379, khớp `.env.example`), tắt bằng `npm run dev:infra:down`.

Dùng Postgres/Redis có sẵn: tạo database riêng (`CREATE DATABASE masoi;`) và chọn một Redis DB index trống (vd. `redis://127.0.0.1:6379/9`). Mọi khóa Redis của game có tiền tố `ww:`. Mở http://localhost:3100, tạo phòng, rồi mở thêm cửa sổ ẩn danh / điện thoại cùng mạng để vào phòng (cần ≥ 4 người chơi).

> Cổng web dev là **3100** (3000 thường bị app khác chiếm). Đổi trong `apps/web/package.json` và `CORS_ORIGINS`.

### Lời dẫn bằng giọng VieNeu

1. Chạy server VieNeu-TTS (đã cài ở `~/Documents/Personal/App/TTS`): `./start-server.sh` → `http://127.0.0.1:8000`.
2. Trong `.env`: `TTS_URL=http://127.0.0.1:8000`, `TTS_VOICE="Hải Đăng"` (giọng nam, giọng Bắc tự nhiên — giống visual-math-engine; có thể đổi sang bất kỳ giọng nào trong `GET /v1/voices`).
3. Game server tự tạo trước lời dẫn khi chuyển pha, cache trong Redis 7 ngày; client phát qua `POST /api/tts`.
4. Không có VieNeu (vd. trên VPS) → phát 62 câu dẫn **đã thu sẵn bằng VieNeu** (`apps/web/public/assets/audio/narration`, không đọc tên người chơi). Thu lại sau khi sửa câu: `npm run narration:generate -w @masoi/web`.

Người chơi bật/tắt lời dẫn bằng nút micro trên thanh trên cùng.

## Lệnh hữu ích

| Lệnh | Mục đích |
|---|---|
| `npm run typecheck` | TypeScript mọi workspace |
| `npm run lint` | ESLint toàn repo |
| `npm test` | Unit + integration (cần `dev:infra`) |
| `npm run test:e2e` | 2 trận đầy đủ (AUTO & HUMAN) bằng nhiều client Socket.IO |
| `npm run test:ui -w @masoi/web` | Playwright: 4 trình duyệt chơi qua giao diện (cần game server đang chạy) |
| `npm run assets:check -w @masoi/web` | Kiểm tra artwork (kích thước, alpha) + cập nhật danh sách asset có sẵn |
| `npm run assets:optimize -w @masoi/web` | Tạo WebP responsive cho artwork |
| `npm run db:seed` | Đồng bộ bảng RoleDefinition (server cũng tự làm khi khởi động) |

## Hình ảnh (ChatGPT)

1. Dán **Master Art Direction Prompt** trong [docs/chatgpt-image-prompts.md](docs/chatgpt-image-prompts.md) vào một cuộc trò chuyện ChatGPT mới, rồi lần lượt từng prompt asset.
2. Lưu ảnh đúng tên file vào `apps/web/public/assets/<thư mục>/` (ví dụ `cards/werewolf.png`).
3. `npm run assets:normalize -w @masoi/web && npm run assets:optimize -w @masoi/web && npm run assets:check -w @masoi/web` (normalize đưa ảnh 1254×1254 của ChatGPT về 1024, tách nền đồng màu cho asset cần trong suốt).
4. Giao diện tự dùng artwork thật thay cho placeholder kỹ thuật — không cần sửa code (mọi đường dẫn nằm ở `apps/web/src/lib/assets.ts`).

## Triển khai chung VPS với Search app (Kestrel)

VPS đã có Caddy + Cloudflare của Kestrel → làm theo **[docs/DEPLOY_VPS_SHARED.md](docs/DEPLOY_VPS_SHARED.md)** (dùng `deploy/vps-shared/`, không cần Nginx/certbot). Cập nhật về sau: `./deploy/vps-shared/push.sh ops@<IP>`.

## Triển khai lên VPS Ubuntu riêng (22.04/24.04)

### 1. Chuẩn bị máy chủ

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# Firewall
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

Trỏ bản ghi DNS `A` của domain (ví dụ `masoi.example.com`) về IP VPS.

### 2. Lấy mã nguồn & cấu hình

```bash
sudo mkdir -p /opt/masoi && sudo chown $USER /opt/masoi
git clone <repo> /opt/masoi && cd /opt/masoi
cp .env.production.example .env.production
nano .env.production    # DOMAIN, POSTGRES_PASSWORD (openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
```

Không có credential nào được hardcode; compose sẽ dừng nếu thiếu `DOMAIN` hoặc `POSTGRES_PASSWORD`.

### 3. Chứng chỉ HTTPS (Let's Encrypt) — lần đầu

```bash
set -a; . ./.env.production; set +a
mkdir -p deploy/certbot/conf deploy/certbot/www
docker run --rm -p 80:80 \
  -v "$PWD/deploy/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly --standalone -d "$DOMAIN" --agree-tos -m you@example.com --no-eff-email
```

Sau đó service `certbot` trong compose tự gia hạn mỗi 12 giờ (webroot qua Nginx). Sau khi gia hạn, nạp lại Nginx: `docker compose --env-file .env.production exec nginx nginx -s reload` (có thể đặt cron hằng tuần).

### 4. Chạy

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps        # tất cả healthy
curl https://$DOMAIN/api/health                      # {"ok":true,"db":true,"redis":true}
```

Thứ tự khởi động: `postgres`, `redis` → `migrate` (`prisma migrate deploy`) → `game-server` → `web` → `nginx`. Trình duyệt chỉ nói chuyện với Nginx: `/` → web, `/api` & `/socket.io` (WSS) → game-server.

### 5. Cập nhật phiên bản

```bash
git pull
docker compose --env-file .env.production up -d --build   # migrate chạy lại tự động
```

Game server tắt mềm (SIGTERM): dừng timer, đóng socket, ngắt DB/Redis. Trận đang diễn ra **không mất**: state nằm trong Postgres, timer được khôi phục từ `Game.nextDeadline` khi server lên lại, client tự kết nối lại.

### 6. Backup

```bash
./scripts/backup-db.sh                      # backups/masoi-YYYYmmdd-HHMMSS.sql.gz (giữ 14 bản)
crontab -e   # 15 3 * * * cd /opt/masoi && ./scripts/backup-db.sh >> backups/backup.log 2>&1
./scripts/restore-db.sh backups/masoi-....sql.gz
```

Nên đồng bộ thư mục `backups/` ra ngoài VPS (rclone/S3).

### 7. Lời dẫn VieNeu trên VPS (tuỳ chọn)

Cài VieNeu-TTS trên VPS (CPU là đủ), chạy `HOST=0.0.0.0 VIENEU_API_KEY=<bí-mật> ./start-server.sh`, chặn cổng 8000 từ Internet (`sudo ufw deny 8000`), rồi đặt trong `.env.production`:

```
TTS_URL=http://host.docker.internal:8000
TTS_API_KEY=<bí-mật>
```

### 8. Log & giám sát

- `docker compose logs -f game-server` — log JSON (pino), không chứa token / vai.
- Healthcheck: `GET /api/health` (DB + Redis), Docker tự restart container lỗi.
- Log được xoay vòng (10MB × 5 file mỗi service).

### Mở rộng

- Tăng số instance: `docker compose up -d --scale game-server=3` — Socket.IO dùng Redis adapter, Nginx `ip_hash` giữ phiên polling, timer mỗi game chỉ được xử lý một lần (Lua pop nguyên tử), ghi state có khóa + optimistic version.

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Web báo “Không kết nối được máy chủ” | Kiểm tra `npm run dev:server` / `docker compose ps`; `NEXT_PUBLIC_GAME_SERVER_URL` (dev) phải trỏ tới `http://localhost:4000` |
| Socket bị CORS | Thêm origin của web vào `CORS_ORIGINS` |
| Trận đứng yên ở chế độ tự động | Mọi người chơi mất kết nối → trận tạm dừng; quá `abandonAfterMinutes` sẽ hủy |
| Không có giọng đọc | `curl http://127.0.0.1:8000/health` (VieNeu); xem `GET /api/tts/status` |

## Trạng thái

Xem [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Artwork: đủ 57/57 ảnh do ChatGPT tạo. Còn thiếu: trang lịch sử trận riêng, load test, metrics.
