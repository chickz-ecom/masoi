# Deploy Ma Sói lên VPS chung với Search app (Kestrel)

VPS của Kestrel đã được dựng bằng `deploy/vps/bootstrap.sh` của Search app: Docker, **Caddy chạy trên host**, ufw chỉ mở 80/443 cho IP Cloudflare, user `ops` (sudo) và `deploy`. Ma Sói chạy kế bên và **dùng chung PostgreSQL + Redis của Kestrel** (từ 2026-11-08), với database, role và tiền tố khoá riêng:

```
Người chơi ──HTTPS/WSS──► Cloudflare (đám mây cam) ──► Caddy trên host (:443)
                                                         ├─ app./search.kestrel-search.com → Kestrel (127.0.0.1:3000 / 8787)
                                                         └─ masoi.tiepdo.online
                                                              ├─ /api/*, /socket.io/* → 127.0.0.1:4100 (game-server)
                                                              └─ còn lại              → 127.0.0.1:3100 (web)
/opt/kestrel  ← Kestrel (compose "kestrel": postgres, redis, typesense, admin, search-api, worker)
/opt/masoi    ← Ma Sói  (compose "masoi":   migrate, game-server, web — KHÔNG có postgres/redis riêng)

mạng Docker ngoài "workspaces_shared" (Kestrel tạo):
  kestrel-postgres-1  alias shared-postgres  ← migrate, game-server, db-tools của Ma Sói (database masoi, role masoi)
  kestrel-redis-1     alias shared-redis     ← game-server của Ma Sói (khoá "ww:…"; Kestrel dùng "sa")
```

| Tài nguyên | Kestrel | Ma Sói |
|---|---|---|
| Cổng 127.0.0.1 | 3000, 8787, 9464, 5432, 6379, 8108 | **3100** (web), **4100** (game-server) |
| PostgreSQL 16 | `kestrel-postgres-1`, database `searchapp` (superuser `searchapp`) | cùng cụm: database **`masoi`**, role **`masoi`** (không superuser, chủ database `masoi`) |
| Redis 7 | `kestrel-redis-1` (`noeviction`, AOF), tiền tố `sa:` | cùng instance, db 0, mọi key + kênh pub/sub có tiền tố **`ww:`** (cố định trong compose) |
| Kết nối Postgres | `max_connections=100` chung | game-server ≤ 10 (`connection_limit=10`), migrate 1, db-tools 1 → tổng ≤ 12 (giới hạn cho Ma Sói: 40) |
| Sao lưu | `deploy/vps/backup.sh` dump mọi database của cụm (gồm `masoi`) mỗi đêm | `scripts/backup-db.sh` — chỉ database `masoi` |

File dùng: [`deploy/vps-shared/`](../deploy/vps-shared) — `compose.yml`, `compose.private-db.yml` (chỉ để quay lại cấu hình cũ), `Caddyfile.masoi`, `env.production.example`, `setup.sh` + `deploy.sh` (chạy trên VPS), `push.sh` (chạy trên Mac); [`scripts/backup-db.sh`, `scripts/restore-db.sh`](../scripts).

Cấu hình production (`/opt/masoi/.env.production`, xem [`env.production.example`](../deploy/vps-shared/env.production.example)):

| Biến | Giá trị | Ý nghĩa |
|---|---|---|
| `MASOI_POSTGRES_HOST` | `shared-postgres` | host Postgres chung trên mạng `workspaces_shared` |
| `MASOI_REDIS_HOST` | `shared-redis` | host Redis chung |
| `POSTGRES_PASSWORD` | (bí mật) | mật khẩu của role `masoi` trên Postgres chung |
| `MASOI_DB_MODE` | `shared` (mặc định) | `private` = quay lại Postgres/Redis riêng cũ (mục cuối) |

Không đặt biến nào thì compose vẫn trỏ tới `shared-postgres` / `shared-redis` — không có đường nào để production tự nối lại Postgres/Redis riêng đã bỏ. Redis db 0, prefix `ww:` và pool `connection_limit=10` cố định trong `compose.yml`.

**Vận hành hằng ngày, bảo trì cùng Kestrel, sự cố, khôi phục từ backup của Kestrel: [RUNBOOK_VPS.md](RUNBOOK_VPS.md).** Dừng / bật Ma Sói: `sudo /opt/masoi/deploy/vps-shared/maintenance.sh stop | start | status`.

---

## Hạ tầng dùng chung (phía Kestrel)

Đã làm trên VPS hiện tại. Chỉ cần lại khi dựng VPS mới, và đó là việc **của repo Search app** (Ma Sói không tạo/xoá mạng, role hay database):

```bash
# 1. Mạng chung — compose của Kestrel khai báo `shared: {external: true, name: workspaces_shared}`
sudo docker network create workspaces_shared
# 2. Compose Kestrel: postgres/redis gắn alias shared-postgres / shared-redis trên mạng đó (deploy/vps/compose.yml)
# 3. Role + database cho Ma Sói (mật khẩu = POSTGRES_PASSWORD trong /opt/masoi/.env.production)
sudo docker exec -i kestrel-postgres-1 psql -X -v ON_ERROR_STOP=1 -U searchapp -d postgres -v pw="<mật khẩu>" <<'SQL'
CREATE ROLE masoi LOGIN PASSWORD :'pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE masoi OWNER masoi;
REVOKE ALL ON DATABASE masoi FROM PUBLIC;
SQL
```

Ma Sói chỉ cần role `masoi` là chủ database `masoi`: `prisma migrate deploy` và game-server chạy được với quyền đó (CI chạy test bằng đúng mô hình quyền này).

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

## Bước 2 — Deploy lần đầu (VPS mới): một lệnh từ Mac

Cần làm trước: [Hạ tầng dùng chung](#hạ-tầng-dùng-chung-phía-kestrel) (mạng + role/database `masoi`).

```bash
cd ~/Documents/Personal/App/"Ma soi"
./deploy/vps-shared/push.sh ops@<IP> --domain masoi.tiepdo.online --cert masoi --build
```

Lệnh này lần lượt (dừng ngay nếu có lỗi):
1. Tạo `/opt/masoi` trên VPS; có `--cert` và file trong `deploy/certs/` → cài chứng chỉ vào Caddy.
2. `rsync` mã nguồn lên (không gửi `node_modules`, `.env`, file tạm).
3. `setup.sh`: tạo `/opt/masoi/.env.production` với mật khẩu ngẫu nhiên cho role `masoi` (phải khớp role trên Postgres chung); sao lưu `/etc/caddy/Caddyfile`, thêm khối domain Ma Sói, `caddy validate` → `systemctl reload caddy`. Caddyfile mới lỗi → **tự khôi phục bản cũ**, Kestrel không bị ảnh hưởng.
4. `deploy.sh --build`: build image (lần đầu ~5–10 phút), migrate DB, chạy game-server + web, chờ health → `== OK — https://<domain>`.

## Bước 3 — Kiểm tra

```bash
curl -s https://<domain>/api/health      # {"ok":true,"db":true,"redis":true,...}
```
Mở `https://<domain>` trên 4 thiết bị và chơi thử một ván. Kestrel vẫn chạy bình thường: `curl -sI https://app.kestrel-search.com | head -1`.

## Bước 4 — Về sau: áp dụng cấu hình ≠ deploy phiên bản app

| Việc | Lệnh (từ Mac) | Build? | Đổi phiên bản app? |
|---|---|---|---|
| Xem trước sẽ đổi gì trên VPS | `./deploy/vps-shared/push.sh ops@<IP> --dry-run` | không | không — không đổi gì |
| Áp dụng cấu hình (`compose.yml`, `.env.production`, script) | `./deploy/vps-shared/push.sh ops@<IP>` | **không** | **không** — giữ đúng image đang chạy |
| Deploy phiên bản app — đã bật CI/CD | `git push` lên `main` ([CICD.md](CICD.md)) | ở GitHub | có |
| Deploy phiên bản app — chưa bật CI/CD | `./deploy/vps-shared/push.sh ops@<IP> --build` | trên VPS | có (lỗi → tự quay về image trước) |

"Áp dụng cấu hình" (`deploy.sh` không tham số) **dừng** thay vì đổi phiên bản nếu: thiếu image trên máy, hoặc image mang tên đó khác image container đang chạy (vd. ai đó đã build lại `masoi-game-server:latest`). Image dùng:

| Chế độ | game-server / web |
|---|---|
| Deploy tay (trước khi bật CI/CD, như VPS hiện tại) | `masoi-game-server:latest`, `masoi-web:latest` (bản trước: `:previous`) |
| CI/CD | `ghcr.io/chickz-ecom/masoi/{game-server,web}:<sha>` — ghi trong `/var/lib/masoi-ci/image.env` |

Trận đang chơi không mất khi game-server khởi động lại: state nằm trong Postgres, timer được khôi phục, người chơi tự kết nối lại.

## Bước 5 — Sao lưu & khôi phục

```bash
cd /opt/masoi
sudo ./scripts/backup-db.sh        # → backups/masoi-YYYYmmdd-HHMMSS.dump, giữ 14 bản
# cron (sudo crontab -e) — dòng cũ có COMPOSE_FILE=… vẫn chạy được, biến đó bị bỏ qua:
20 3 * * * cd /opt/masoi && ./scripts/backup-db.sh >> backups/backup.log 2>&1
sudo ./scripts/restore-db.sh backups/masoi-YYYYmmdd-HHMMSS.dump     # cũng nhận bản cutover .dump và .sql.gz cũ
```

- **Backup** chạy `pg_dump -Fc` trong container một lần `db-tools` (PostgreSQL 16, mạng `workspaces_shared`) bằng role `masoi` → chỉ có database `masoi`; bản dump được kiểm tra đọc được (`pg_restore --list`) trước khi đặt tên thật. Game vẫn chạy trong lúc dump.
- **Restore** dừng ngay ở lỗi đầu tiên: kiểm tra file + đích (đúng `masoi`/`masoi`, role không superuser) → gõ `masoi` xác nhận → sao lưu hiện trạng `backups/masoi-prerestore-*.dump` → dừng game-server + web → **một transaction**: xoá schema `public` của database `masoi`, nạp bản sao lưu, COMMIT chỉ khi đọc hết không lỗi (lỗi → ROLLBACK, database như cũ) → `prisma migrate deploy` → bật lại app. Không có `\connect` / `CREATE DATABASE` / `DROP DATABASE`; file `.sql` có những lệnh đó bị từ chối. Redis không bị xoá (chung với Kestrel).
- Kestrel cũng dump `masoi` hằng đêm vào `/opt/kestrel/backups` (+ R2) — dùng được với `restore-db.sh`.
- Đưa bản của Ma Sói ra ngoài VPS: dùng chung remote rclone `r2` của Kestrel, vd. `rclone copy /opt/masoi/backups r2:<bucket>/masoi --max-age 48h`.

## Quay lại cấu hình cũ (Postgres/Redis riêng)

Chỉ khi Postgres/Redis chung có sự cố kéo dài. Volume cũ `masoi_pg`, `masoi_redis` và container đã dừng `masoi-postgres-1`, `masoi-redis-1` vẫn còn (compose không xoá orphan); `compose.private-db.yml` định nghĩa lại đúng hai service đó.

```bash
# 0. (đã bật CI/CD) tạm dừng auto-deploy:    gh variable set DEPLOY_ENABLED -b false
ssh ops@<IP>
cd /opt/masoi
sudo ./scripts/backup-db.sh                             # 1. dữ liệu mới nhất từ Postgres chung (nếu còn đọc được)
echo 'MASOI_DB_MODE=private' | sudo tee -a .env.production >/dev/null
# (mật khẩu Postgres riêng cũ khác POSTGRES_PASSWORD → thêm MASOI_PRIVATE_POSTGRES_PASSWORD=<mật khẩu cũ>)
sudo ./deploy/vps-shared/deploy.sh                      # 2. bật lại postgres/redis riêng, app nối vào đó (không build)
sudo ./scripts/restore-db.sh backups/masoi-<bản vừa tạo>.dump   # 3. đưa dữ liệu sau cutover vào Postgres riêng
curl -s http://127.0.0.1:4100/api/health
```

Không làm bước 3 thì Postgres riêng có dữ liệu tại thời điểm cutover (bản dump lúc đó: `/srv/workspaces/shared/backups/masoi-cutover-20261108-060154/masoi.dump`). Database `masoi` trên Postgres chung vẫn nằm nguyên.

Trở lại dùng chung:
```bash
sudo ./scripts/backup-db.sh                             # (đang ở private) lấy dữ liệu mới nhất
sudo sed -i '/^MASOI_DB_MODE=/d' .env.production
sudo ./deploy/vps-shared/deploy.sh                      # app nối lại shared-postgres / shared-redis
sudo ./scripts/restore-db.sh backups/masoi-<bản vừa tạo>.dump   # nếu có dữ liệu mới trong thời gian chạy private
sudo docker compose -f deploy/vps-shared/compose.yml -f deploy/vps-shared/compose.private-db.yml \
  --env-file .env.production stop postgres redis       # dừng lại Postgres/Redis riêng (giữ volume)
# gh variable set DEPLOY_ENABLED -b true
```

Dọn hẳn cấu hình cũ (chỉ khi chắc không cần quay lại — **xoá dữ liệu cũ, không hoàn tác được**): `sudo docker rm masoi-postgres-1 masoi-redis-1`, rồi `sudo docker volume rm masoi_pg masoi_redis`.

## Lời dẫn giọng VieNeu — KHÔNG cần cài VieNeu lên VPS

62 câu dẫn (đêm/ngày thứ mấy, gọi từng vai, bình minh, bỏ phiếu, kết quả, đội thắng…) được **thu sẵn bằng VieNeu giọng "Hải Đăng"** trên máy dev và nằm trong web dưới dạng mp3 tĩnh (`apps/web/public/assets/audio/narration/`, ~1,3 MB). Để trống `TTS_URL` trên VPS → người chơi nghe đúng giọng Hải Đăng, không tốn CPU của VPS. Khác biệt duy nhất: bản thu sẵn không đọc tên người chơi (tên vẫn hiện trên màn hình).

Đổi giọng hoặc sửa câu dẫn (`packages/shared/src/narration.ts` → `NARRATION_CLIPS`): trên Mac bật VieNeu rồi chạy
```bash
npm run narration:generate -w @masoi/web     # chỉ thu lại câu mới/đã sửa; --force để thu lại tất cả
git commit … && git push                     # CI/CD; chưa bật: ./deploy/vps-shared/push.sh ops@<IP> --build
```

Chỉ khi muốn đọc cả tên người chơi mới cần VieNeu chạy trực tiếp: cài vào VPS, `HOST=172.17.0.1 VIENEU_PRECISION=int8 ./start-server.sh` (systemd), đặt `TTS_URL=http://host.docker.internal:8000` trong `.env.production`. Nó dùng CPU và tranh tài nguyên với Kestrel — không khuyến nghị.

## Xử lý sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| Cloudflare 502/521 | `curl -I http://127.0.0.1:3100/`, `curl http://127.0.0.1:4100/api/health`, `sudo systemctl status caddy` |
| `network workspaces_shared declared as external, but could not be found` | Mạng chung chưa có / bị xoá: phía Kestrel `sudo docker network create workspaces_shared` rồi `up` lại compose Kestrel (gắn alias) |
| health `db:false` / `redis:false`, log `getaddrinfo ENOTFOUND shared-postgres` | Container Kestrel chưa gắn alias: `sudo docker network inspect workspaces_shared` phải thấy `kestrel-postgres-1`, `kestrel-redis-1` |
| `password authentication failed for user "masoi"` | `POSTGRES_PASSWORD` trong `.env.production` khác mật khẩu role `masoi` trên Postgres chung |
| `thiếu image trên máy` khi áp dụng cấu hình | Đúng ý: áp dụng cấu hình không build/pull. Deploy phiên bản: `git push` hoặc `push.sh --build` |
| `… đang chạy image X, nhưng … là Y` | Tag image đã bị đổi (build lại?). Kiểm tra rồi mới chạy `sudo MASOI_ALLOW_IMAGE_CHANGE=1 ./deploy/vps-shared/deploy.sh` |
| Cảnh báo `Found orphan containers ([masoi-postgres-1 masoi-redis-1])` | Bình thường: container cũ giữ để quay lại cấu hình cũ |
| Vào được trang nhưng "Không kết nối được máy chủ" | `DOMAIN` trong `.env.production` phải đúng domain đang mở (dùng cho CORS); WebSockets bật trên Cloudflare |
| Mọi người cùng bị "thao tác quá nhanh" | Caddy thiếu `header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}` |
| Build bị kill (OOM) | `free -h`; tạm dừng worker của Kestrel khi build, hoặc bật CI/CD (build ở GitHub) |
| Xem log | `sudo docker compose -f deploy/vps-shared/compose.yml --env-file .env.production logs -f --tail=100 game-server web` |
| Gỡ Ma Sói | xoá khối Ma Sói khỏi Caddyfile + reload; `sudo docker compose -f deploy/vps-shared/compose.yml --env-file .env.production down` (không đụng mạng/Postgres/Redis chung); database `masoi` + role `masoi` do phía Kestrel xoá |
