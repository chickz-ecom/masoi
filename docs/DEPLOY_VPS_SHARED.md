# Deploy Ma Sói lên VPS chung với Search app (Kestrel)

VPS của Kestrel đã được dựng bằng `deploy/vps/bootstrap.sh` của Search app: Docker, **Caddy chạy trên host**, ufw chỉ mở 80/443 cho IP Cloudflare, user `ops` (sudo) và `deploy`. Ma Sói chạy kế bên, **không đụng** gì của Kestrel:

```
Người chơi ──HTTPS/WSS──► Cloudflare (đám mây cam) ──► Caddy trên host (:443)
                                                         ├─ app./search.kestrel-search.com → Kestrel (127.0.0.1:3000 / 8787)
                                                         └─ <domain Ma Sói>
                                                              ├─ /api/*, /socket.io/* → 127.0.0.1:4100 (game-server)
                                                              └─ còn lại              → 127.0.0.1:3100 (web)
/opt/kestrel  ← Kestrel (compose "kestrel": postgres, redis, typesense, admin, search-api, worker)
/opt/masoi    ← Ma Sói  (compose "masoi":   postgres, redis, migrate, game-server, web) — volume & mạng riêng
```

| Tài nguyên | Kestrel | Ma Sói |
|---|---|---|
| Cổng 127.0.0.1 | 3000, 8787, 9464, 5432, 6379, 8108 | **3100** (web), **4100** (game-server) |
| Postgres / Redis | riêng | riêng, không publish cổng, giới hạn RAM (384 MB / 160 MB) |
| RAM ước tính Ma Sói | — | ~0,8–1,2 GB khi chạy; build lần đầu cần ~2 GB (swap 4 GB của bootstrap là đủ) |

File dùng: [`deploy/vps-shared/`](../deploy/vps-shared) — `compose.yml`, `Caddyfile.masoi`, `env.production.example`, `setup.sh` + `deploy.sh` (chạy trên VPS), `push.sh` (chạy trên Mac, gọi hai script kia).

---

## Bước 0 — Chọn VPS và kiểm tra tài nguyên

Production của Kestrel (≥ 16 GB) dư sức. Staging (4 GB) chạy được nhưng sát — nên đặt Ma Sói ở máy production nếu còn > 2 GB RAM trống:

```bash
ssh ops@<IP>
free -h && df -h / && sudo docker stats --no-stream
```

## Bước 1 — Domain trên Cloudflare

Chọn một trong hai:

**A. Subdomain của domain Kestrel** (vd. `masoi.kestrel-search.com`) — nhanh nhất nếu chứng chỉ Origin hiện tại là wildcard:
```bash
sudo openssl x509 -in /etc/caddy/certs/origin.pem -noout -ext subjectAltName
# Thấy "*.kestrel-search.com" → dùng lại được (giữ `import origin_tls` trong Caddyfile.masoi)
```

**B. Domain khác** (vd. `masoi.tiepdo.online`, zone `tiepdo.online` trên Cloudflare): zone đó → SSL/TLS → **Full (strict)** (hoặc Configuration Rule riêng cho subdomain nếu zone còn site khác dùng Flexible) → Origin Server → **Create Certificate** (giữ mặc định: `*.tiepdo.online`, `tiepdo.online`, 15 năm). Lưu hai ô vào project (thư mục đã gitignore, không rsync, không vào Docker image — xem [`deploy/certs/README.md`](../deploy/certs/README.md)):
```
deploy/certs/masoi.pem   ← Origin Certificate
deploy/certs/masoi.key   ← Private Key (chỉ hiện một lần)
```
`push.sh ... --cert masoi` ở Bước 2 tự cài chúng lên VPS (`/etc/caddy/certs/masoi.{pem,key}`, root:caddy, 640) sau khi kiểm tra khoá khớp chứng chỉ. Cài riêng lẻ (vd. khi gia hạn): `./deploy/vps-shared/install-cert.sh ops@<IP>`.

Rồi trong Cloudflare DNS: bản ghi **A** `masoi` (hoặc `@`) → IP VPS, **Proxied (đám mây cam)**. Kiểm tra Network → **WebSockets: On** (mặc định bật).

> Bắt buộc proxied: ufw chỉ cho IP Cloudflare vào 80/443, trỏ thẳng (đám mây xám) sẽ bị chặn.

## Bước 2 — Deploy lần đầu: một lệnh từ Mac

```bash
cd ~/Documents/Personal/App/"Ma soi"
# Subdomain dùng chung chứng chỉ Origin của Kestrel:
./deploy/vps-shared/push.sh ops@<IP> --domain masoi.kestrel-search.com
# Hoặc domain khác (chứng chỉ nằm ở deploy/certs/masoi.{pem,key} — Bước 1B):
./deploy/vps-shared/push.sh ops@<IP> --domain masoi.tiepdo.online --cert masoi
```

Lệnh này lần lượt (dừng ngay nếu có lỗi):
1. Tạo `/opt/masoi` trên VPS; có `--cert` và file trong `deploy/certs/` → cài chứng chỉ vào Caddy.
2. `rsync` mã nguồn lên (không gửi `node_modules`, `.env`, file tạm).
3. `setup.sh`: tạo `/opt/masoi/.env.production` với mật khẩu Postgres ngẫu nhiên; sao lưu `/etc/caddy/Caddyfile`, thêm khối domain Ma Sói, `caddy validate` → `systemctl reload caddy`. Caddyfile mới lỗi → **tự khôi phục bản cũ**, Kestrel không bị ảnh hưởng.
4. `deploy.sh`: build image (lần đầu ~5–10 phút), migrate DB, chạy game-server + web, chờ health → `== OK — https://<domain>`.

## Bước 3 — Kiểm tra

```bash
curl -s https://<domain>/api/health      # {"ok":true,"db":true,"redis":true,...}
```
Mở `https://<domain>` trên 4 thiết bị và chơi thử một ván. Kestrel vẫn chạy bình thường: `curl -sI https://app.kestrel-search.com | head -1`.

Làm tay thay vì script: xem nội dung `deploy/vps-shared/setup.sh` (tạo `.env.production` từ `env.production.example`, nối `Caddyfile.masoi` vào Caddyfile).

## Bước 4 — Cập nhật phiên bản (về sau)

Từ Mac, một lệnh:
```bash
./deploy/vps-shared/push.sh ops@<IP>
```
= rsync mã nguồn (giữ nguyên `.env.production`, `backups/` trên VPS) → `deploy.sh` trên VPS. Trận đang chơi không mất: state nằm trong Postgres, timer được khôi phục, người chơi tự kết nối lại.

## Bước 5 — Sao lưu

```bash
cd /opt/masoi
sudo COMPOSE_FILE=deploy/vps-shared/compose.yml ENV_FILE=.env.production ./scripts/backup-db.sh
# cron (sudo crontab -e):
20 3 * * * cd /opt/masoi && COMPOSE_FILE=deploy/vps-shared/compose.yml ENV_FILE=.env.production ./scripts/backup-db.sh >> backups/backup.log 2>&1
```
Muốn đưa ra ngoài VPS: dùng chung remote rclone `r2` của Kestrel, vd. thêm vào cron `rclone copy /opt/masoi/backups r2:<bucket>/masoi --max-age 48h`.

## Lời dẫn giọng VieNeu — KHÔNG cần cài VieNeu lên VPS

62 câu dẫn (đêm/ngày thứ mấy, gọi từng vai, bình minh, bỏ phiếu, kết quả, đội thắng…) được **thu sẵn bằng VieNeu giọng "Hải Đăng"** trên máy dev và nằm trong web dưới dạng mp3 tĩnh (`apps/web/public/assets/audio/narration/`, ~1,3 MB). Để trống `TTS_URL` trên VPS → người chơi nghe đúng giọng Hải Đăng, không tốn CPU của VPS. Khác biệt duy nhất: bản thu sẵn không đọc tên người chơi (tên vẫn hiện trên màn hình).

Đổi giọng hoặc sửa câu dẫn (`packages/shared/src/narration.ts` → `NARRATION_CLIPS`): trên Mac bật VieNeu rồi chạy
```bash
npm run narration:generate -w @masoi/web     # chỉ thu lại câu mới/đã sửa; --force để thu lại tất cả
./deploy/vps-shared/push.sh ops@<IP>
```

Chỉ khi muốn đọc cả tên người chơi mới cần VieNeu chạy trực tiếp: cài vào VPS, `HOST=172.17.0.1 VIENEU_PRECISION=int8 ./start-server.sh` (systemd), đặt `TTS_URL=http://host.docker.internal:8000` trong `.env.production`. Nó dùng CPU và tranh tài nguyên với Kestrel — không khuyến nghị.

## Xử lý sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| Cloudflare 502/521 | `curl -I http://127.0.0.1:3100/`, `curl http://127.0.0.1:4100/api/health`, `sudo systemctl status caddy` |
| Vào được trang nhưng "Không kết nối được máy chủ" | `DOMAIN` trong `.env.production` phải đúng domain đang mở (dùng cho CORS); WebSockets bật trên Cloudflare |
| Mọi người cùng bị "thao tác quá nhanh" | Caddy thiếu `header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}` |
| Build bị kill (OOM) | `free -h`; tạm dừng worker của Kestrel khi build, hoặc build image ở GitHub Actions/GHCR như Kestrel |
| Xem log | `sudo docker compose -f deploy/vps-shared/compose.yml --env-file .env.production logs -f --tail=100 game-server web` |
| Gỡ Ma Sói | xoá khối Ma Sói khỏi Caddyfile + reload; `docker compose ... down` (thêm `-v` nếu muốn xoá dữ liệu) |
