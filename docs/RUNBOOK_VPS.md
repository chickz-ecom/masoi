# Runbook vận hành Ma Sói trên VPS (PostgreSQL / Redis dùng chung với Kestrel)

Deploy, cấu hình, CI/CD: [DEPLOY_VPS_SHARED.md](DEPLOY_VPS_SHARED.md), [CICD.md](CICD.md). Trang này: chạy hằng ngày, bảo trì, sự cố, khôi phục.
Mọi lệnh 🖥 chạy trên VPS bằng `ssh ops@147.93.182.84` (user `ops`, có sudo; Docker cần `sudo`).

## Tóm tắt

| | Giá trị |
|---|---|
| Thư mục | `/opt/masoi` (symlink `/srv/workspaces/projects/ma-soi`) — user `ops` sở hữu |
| Compose | project **`masoi`**, file `/opt/masoi/deploy/vps-shared/compose.yml` + `--env-file .env.production` (+ `--env-file /var/lib/masoi-ci/image.env` khi đã bật CI/CD — các script tự ghép) |
| Container | `masoi-game-server-1` (127.0.0.1:4100), `masoi-web-1` (127.0.0.1:3100); một lần: `masoi-migrate-1` (mỗi lần deploy), `masoi-db-tools-run-*` (sao lưu / khôi phục) |
| Nối `workspaces_shared` | `game-server`, `migrate`, `db-tools`. **`web` không** (Next.js không dùng DB / Redis) |
| Postgres | `shared-postgres:5432`, database `masoi`, role `masoi` (không superuser). Migration: Prisma Migrate (`prisma migrate deploy`), không extension, không cần superuser |
| Redis | `shared-redis:6379`, db 0, mọi key + kênh pub/sub bắt đầu bằng `ww:` |
| Health | `curl -s http://127.0.0.1:4100/api/health` · `https://masoi.tiepdo.online/api/health` → `{"ok":true,"db":true,"redis":true,"ready":true,…}`; HTTP 503 khi một trong ba là `false` |

## Phụ thuộc vào dịch vụ chung

PostgreSQL (`kestrel-postgres-1`) và Redis (`kestrel-redis-1`) **thuộc Kestrel**: compose `/opt/kestrel/compose.yml` (project `kestrel`), repo Search app — [`docs/ops/cicd-vps.md`](../../Search%20app/docs/ops/cicd-vps.md) mục 11 và ADR 0027 (cùng thư mục `Personal/App`). Mạng `workspaces_shared` tạo tay, không thuộc compose nào. Ma Sói chỉ là client:

- **Không** sửa `/opt/kestrel`, không chạy `docker compose` của Kestrel, không `restart` / tạo lại `kestrel-postgres-1`, `kestrel-redis-1`, không tạo / xoá mạng `workspaces_shared`. `docker compose down` của Ma Sói không đụng tới mạng hay dữ liệu chung.
- Redis: chỉ db 0, chỉ key `ww:`; cấm `FLUSHALL`, `FLUSHDB`, `KEYS *`, `SCAN` không có prefix.
- **Trước khi bảo trì Postgres / Redis chung** (khởi động lại, nâng image, đổi cấu hình, khôi phục `masoi`): chủ app (cùng một người cho cả hai app) chọn giờ ít người chơi, chạy [`maintenance.sh stop`](#dừng--bật) bên Ma Sói, bảo trì, rồi `maintenance.sh start`. Khởi động lại ngắn (vài giây) không bắt buộc dừng Ma Sói: game-server tự kết nối lại (bên dưới), chỉ các thao tác trong lúc đó báo lỗi.
- Cần thêm database / role / extension cho Ma Sói: làm bằng superuser `searchapp` phía Kestrel. Hiện **không cần extension nào**.

### Khi Postgres / Redis chung gián đoạn, Ma Sói làm gì

Đã thử trên mô phỏng (Postgres 16 + Redis 7 với alias `shared-postgres` / `shared-redis`), container game-server không khởi động lại lần nào:

| Tình huống | Health | Hồi phục |
|---|---|---|
| `restart` Postgres / Redis (vài giây) | `db=false` / `redis=false`, HTTP 503 | ~1 s sau khi dịch vụ lên lại, tự động |
| `pg_terminate_backend` ("terminating connection due to administrator command") | `db=false` một lần | lần kiểm sau đó |
| Postgres tắt 15 s | `db=false` suốt thời gian tắt | tự động |
| game-server khởi động khi Postgres hoặc Redis đang tắt (VPS reboot) | trả lời ngay `ready=false` + `db`/`redis=false`, không thoát, không crash-loop | thử lại với backoff ≤ 5 s → `ready=true` |

Trận đang chơi không mất: state nằm trong Postgres; người chơi tự kết nối lại. Trong lúc gián đoạn, thao tác của người chơi báo lỗi.

## Dừng / bật

`maintenance.sh` dừng mọi thứ **ghi** vào `masoi` / `ww:` (game-server là process chạy lâu duy nhất; deploy tay và CI bị chặn bằng cờ `/opt/masoi/.maintenance` để không ai bật lại giữa chừng). Không đổi image, không build, không tạo lại container. `web` vẫn chạy (người chơi thấy "đang kết nối lại").

```bash
sudo /opt/masoi/deploy/vps-shared/maintenance.sh status                # cờ bảo trì, container, health, số kết nối Postgres
sudo /opt/masoi/deploy/vps-shared/maintenance.sh stop "nâng Postgres"  # dừng game-server, chặn deploy
sudo /opt/masoi/deploy/vps-shared/maintenance.sh start                 # migrate → game-server → chờ health → bỏ chặn
```

Sau `stop`, phía Kestrel kiểm không còn phiên nào: `select count(*) from pg_stat_activity where datname = 'masoi'` = 0.

## Thường dùng

```bash
curl -s http://127.0.0.1:4100/api/health
sudo docker inspect -f '{{.State.Health.Status}}' masoi-game-server-1 masoi-web-1
sudo docker logs -f --tail=100 masoi-game-server-1        # log JSON (pino); không có mật khẩu / URL có mật khẩu
sudo docker logs --tail=100 masoi-web-1
sudo docker restart masoi-game-server-1                  # khởi động lại game-server (không tạo lại container)
sudo docker network inspect workspaces_shared --format '{{range .Containers}}{{.Name}} {{end}}'
# Key Redis của Ma Sói (client tạm trên mạng chung, chỉ đọc, SCAN theo prefix):
sudo docker run --rm --network workspaces_shared redis:7-alpine redis-cli -h shared-redis --scan --pattern 'ww:*' | head
```

Log khởi động cho biết đích kết nối (không có mật khẩu): `"db":{"host":"shared-postgres:5432","database":"masoi","connectionLimit":"10"},"redis":{"host":"shared-redis:6379","db":"0","prefix":"ww:"}`.

## Tài nguyên dùng chung

**Kết nối Postgres** (`max_connections=100` chung; Ma Sói được tối đa 40):

| Process | Kết nối tối đa | Ghi chú |
|---|---|---|
| game-server (1 bản) | **10** | `connection_limit=10` trong `DATABASE_URL` (compose.yml); đo được: 30 truy vấn song song → đúng 10 kết nối |
| migrate | 1 | mỗi lần deploy, trước khi game-server mới lên; đo được: chạy được khi role giới hạn 1 kết nối |
| db-tools | 1 | `backup-db.sh` / `restore-db.sh` / `maintenance.sh status` |
| **Tổng** | **≤ 12** | Thêm bản game-server thì +10 mỗi bản |

**Redis** (db 0, `maxmemory 1gb`, `noeviction` — đầy là cả hai app lỗi ghi):

| Key / kênh | Kiểu | TTL | Nội dung |
|---|---|---|---|
| `ww:lock:room:<id>`, `ww:lock:game:<id>` | string | 10 s (`PX`) | khoá phân tán |
| `ww:rl:<khoá>:<cửa sổ>` | string | cửa sổ + 1 s | giới hạn tần suất sự kiện socket |
| `ww:http-rl:<route>-<ip>` | string | 1 phút | giới hạn tần suất HTTP (`@fastify/rate-limit`) |
| `ww:tts:<sha256>` | string (mp3) | 7 ngày | cache giọng đọc — chỉ khi đặt `TTS_URL`; production để trống → không có |
| `ww:timers` | sorted set | không (không phải key tạm) | hạn chót pha của các trận đang chạy, mỗi trận một phần tử, xoá khi tới hạn; dựng lại từ Postgres (`Game.nextDeadline`) mỗi lần game-server khởi động |
| `ww:sio#/#…`, `ww:sio-request#/#`, `ww:sio-response#/#…` | kênh pub/sub | — | adapter Socket.IO (không chiếm bộ nhớ key) |

Không có hàng đợi (BullMQ…). Client Redis đặt tên `masoi-cmd`, `masoi-pub` (xem bằng `CLIENT LIST`).

**Không có dữ liệu Redis nào phải còn khi mất máy** → Kestrel không cần thêm bản sao RDB cho Ma Sói. Lưu ý duy nhất: nếu Redis mất dữ liệu (volume mất, ai đó xoá key) trong khi game-server vẫn chạy, trận ở chế độ tự động sẽ đứng vì mất `ww:timers` → `sudo docker restart masoi-game-server-1` (timer được dựng lại từ Postgres).

## Sự cố

| Triệu chứng (health / log game-server) | Kiểm | Xử lý |
|---|---|---|
| `db=false`, log `Can't reach database server at shared-postgres:5432` hoặc `could not translate host name "shared-postgres"` / `getaddrinfo ENOTFOUND shared-postgres` | `sudo docker ps --filter name=kestrel-postgres-1`; `sudo docker network inspect workspaces_shared --format '{{range .Containers}}{{.Name}} {{end}}'`; `sudo docker inspect -f '{{(index .NetworkSettings.Networks "workspaces_shared").Aliases}}' kestrel-postgres-1` | Postgres tắt / container được tạo lại mà mất mạng chung hoặc alias → **phía Kestrel** sửa (cicd-vps.md 11.4, 3.7). Ma Sói không cần làm gì: tự nối lại khi tên phân giải được |
| `redis=false`, log `getaddrinfo ENOTFOUND shared-redis` / `ECONNREFUSED …:6379` | như trên với `kestrel-redis-1` | như trên |
| `masoi-game-server-1` không có trong `network inspect workspaces_shared` (`db`/`redis=false`) | `sudo docker inspect -f '{{json .NetworkSettings.Networks}}' masoi-game-server-1` | `sudo docker network connect workspaces_shared masoi-game-server-1` — tự hồi trong ~2 s, không khởi động lại. (`deploy.sh` **không** nối lại mạng cho container đang chạy — đã thử) |
| `network workspaces_shared declared as external, but could not be found` khi deploy | `sudo docker network ls \| grep workspaces_shared` | Mạng bị xoá: phía Kestrel tạo lại và nối hai dịch vụ (cicd-vps.md 11.5) |
| `password authentication failed for user "masoi"` | — | `POSTGRES_PASSWORD` trong `/opt/masoi/.env.production` khác mật khẩu role `masoi` |
| `too many connections` / `remaining connection slots are reserved` | phía Kestrel: lệnh `pg_stat_activity` (cicd-vps.md 11.3) | Ma Sói tối đa ~12; xem app nào vượt |
| Redis `OOM command not allowed` | `sudo docker run --rm --network workspaces_shared redis:7-alpine redis-cli -h shared-redis info memory \| grep used_memory_human` | Đếm key `ww:` (lệnh ở trên); key của Ma Sói đều có TTL trừ `ww:timers` (nhỏ) |
| Hết sự cố > 1 phút mà health vẫn `false` | `sudo /opt/masoi/deploy/vps-shared/maintenance.sh status`; log | `sudo docker restart masoi-game-server-1` |
| Trận tự động đứng sau khi Redis mất dữ liệu | — | `sudo docker restart masoi-game-server-1` |
| Deploy báo `Ma Sói đang dừng bảo trì` | `sudo /opt/masoi/deploy/vps-shared/maintenance.sh status` | Xong bảo trì: `maintenance.sh start` |

## Khôi phục database `masoi`

**A. Từ backup của Kestrel** (`/opt/kestrel/backups/postgres/masoi/`, mỗi đêm 03:15 UTC, giữ 7 ngày) — làm theo Search app [`docs/ops/cicd-vps.md`](../../Search%20app/docs/ops/cicd-vps.md) **mục 7.3**, phần của Ma Sói là dừng / bật:

1. Phía Kestrel: khôi phục ra database phụ **`masoi_restore`** (owner `masoi`) trong lúc Ma Sói vẫn chạy; kiểm số dòng.
2. 🖥 Ma Sói: `sudo /opt/masoi/deploy/vps-shared/maintenance.sh stop "khôi phục masoi"`.
3. Phía Kestrel: `pg_terminate_backend` các phiên còn lại của `masoi` (sau bước 2), đổi tên `masoi` → `masoi_old_<ngày>`, `masoi_restore` → `masoi`.
4. 🖥 Ma Sói: `sudo /opt/masoi/deploy/vps-shared/maintenance.sh start` (migrate đưa schema lên đúng phiên bản app, rồi bật game-server).
5. Giữ `masoi_old_<ngày>` vài ngày rồi phía Kestrel mới `dropdb`.

Đã diễn tập đủ 5 bước trên mô phỏng (bản dump `pg_dump -Fc` bằng superuser, như `backup.sh`): sau bước 4 game-server chạy trên dữ liệu của bản dump.

**B. Từ bản của Ma Sói** (`/opt/masoi/backups/masoi-*.dump`, `scripts/backup-db.sh`), không cần quyền superuser: `cd /opt/masoi && sudo ./scripts/restore-db.sh backups/masoi-<giờ>.dump` — tự dừng / bật app, một transaction, lỗi → ROLLBACK ([DEPLOY_VPS_SHARED.md](DEPLOY_VPS_SHARED.md) Bước 5). Cũng nhận bản `.dump` của Kestrel.

Redis không cần khôi phục (xem trên).
