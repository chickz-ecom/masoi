# CI/CD — push lên `main` là tự deploy

```
git push (main) ─► GitHub Actions "CI"
                     ├─ check: lint · typecheck · test (Postgres/Redis thật) · e2e 2 trận
                     └─ image: ghcr.io/<owner>/<repo>/{game-server,web}:<commit sha>   (build ở GitHub, không build trên VPS)
                 ─► CI xanh ─► "Deploy": ssh masoi-ci@VPS <sha>
                                 └─ masoi-ci-deploy: pull → migration → game-server → web → health
                                    (lỗi migration: giữ bản đang chạy · lỗi sau khi đổi image: quay về bản trước)
                                    migration + game-server dùng Postgres/Redis CHUNG với Kestrel (shared-postgres,
                                    shared-redis, database/role masoi) — CI/CD không bật lại Postgres/Redis riêng
                 ─► smoke test https://masoi.tiepdo.online/api/health
```

Thường mất ~6–8 phút từ lúc push tới lúc lên. Commit chỉ sửa `docs/**` hoặc `*.md` không chạy CI, không deploy. PR chỉ chạy `check`.

## Bật một lần

Điều kiện:
- Ma Sói đang chạy trên VPS và **cấu hình production đã đồng bộ** (`push.sh --dry-run` không còn khác biệt ngoài ý muốn — [DEPLOY_VPS_SHARED.md](DEPLOY_VPS_SHARED.md) Bước 4). Bước 4 của script rsync file lên VPS.
- Workflow + file deploy **đã commit** (`.github/`, `deploy/vps-shared/`, `scripts/`) — script dừng nếu chưa.
- `gh auth login` (quyền `repo`, `workflow`).

```bash
cd ~/Documents/Personal/App/"Ma soi"
./scripts/setup-cicd.sh ops@147.93.182.84          # repo = origin (chickz-ecom/masoi); chưa có origin: <tài khoản gh>/ma-soi
```

Script làm lần lượt (chạy lại an toàn):
1. Git: chưa có commit → `git init` + commit đầu tiên (dừng nếu thấy `.env`, chứng chỉ hoặc khoá sắp vào commit); đã có → kiểm tra workflow + file deploy đã commit.
2. Repo GitHub: dùng `origin` nếu có; không thì tạo repo **private** (`--repo owner/tên` để đổi). Tên repo quyết định tên image: `ghcr.io/chickz-ecom/masoi/…`.
3. Tạo key CI `deploy/certs/masoi-ci` (gitignore, không rsync).
4. VPS: đồng bộ file, chạy [`ci-install.sh`](../deploy/vps-shared/ci-install.sh) bằng `sudo` — tạo user `masoi-ci`, thử key.
5. GitHub: secret `VPS_SSH_KEY`; biến `VPS_HOST`, `VPS_KNOWN_HOSTS` (lấy từ `~/.ssh/known_hosts` của Mac), `APP_URL`, `DEPLOY_ENABLED=true`.
6. `git push -u origin main` → lần deploy CI đầu tiên. Theo dõi: `gh run watch` hoặc tab Actions.

## Dùng hằng ngày

| Việc | Cách |
|---|---|
| Đưa code mới lên | `git push` (nhánh `main`) |
| Xem tiến trình / log | `gh run watch`, `gh run view --log-failed` |
| Deploy lại / rollback về một commit | Actions → **Deploy** → Run workflow → nhập SHA (commit đã qua CI trên main); hoặc `gh workflow run deploy.yml -f sha=<sha>` |
| Dọn image cũ trên GHCR | Job `prune-images` sau mỗi lần deploy giữ 10 bản gần nhất mỗi image |
| Tạm tắt auto-deploy | `gh variable set DEPLOY_ENABLED -b false` (CI vẫn chạy) |
| Đổi `compose.yml`, `.env.production`, script deploy | `./deploy/vps-shared/push.sh ops@147.93.182.84 --dry-run` để xem trước, rồi bỏ `--dry-run`: đồng bộ file + áp dụng cấu hình, **không build, không đổi image** (giữ image CI đang chạy). `push.sh --build` bị từ chối khi CI/CD đang bật |
| Sửa `ci-deploy.sh` | Commit, rồi chạy lại `./scripts/setup-cicd.sh ops@147.93.182.84` (cài lại `/usr/local/sbin/masoi-ci-deploy`) |
| Sửa câu dẫn / giọng | `npm run narration:generate -w @masoi/web` (VieNeu trên Mac) → commit → push |

## Image và lần CI deploy đầu tiên

`compose.yml` lấy image từ `MASOI_GAME_SERVER_IMAGE` / `MASOI_WEB_IMAGE`; không có thì dùng image deploy tay `masoi-game-server:latest` / `masoi-web:latest` — **đúng image đang chạy trên VPS trước khi bật CI/CD**, nên cài CI/CD (`ci-install.sh`, `MASOI_TAG` rỗng) và áp dụng cấu hình không đổi phiên bản app.

- Mỗi lần CI deploy ghi `/var/lib/masoi-ci/image.env`: `MASOI_IMAGE`, `MASOI_TAG=<sha>`, `MASOI_GAME_SERVER_IMAGE`, `MASOI_WEB_IMAGE` (= `ghcr.io/chickz-ecom/masoi/{game-server,web}:<sha>`).
- Lần CI deploy **đầu tiên** lỗi sau khi đổi image → quay về image deploy tay (`MASOI_TAG` rỗng lại). Lỗi migration → giữ nguyên.
- Image deploy tay **không tự xoá** (đường lui khi tắt CI/CD). Sau vài lần CI deploy ổn định, xoá tay: `sudo docker rmi masoi-game-server:latest masoi-web:latest masoi-game-server:previous masoi-web:previous`.
- Tắt hẳn CI/CD, quay về deploy tay: `gh variable set DEPLOY_ENABLED -b false`, rồi trên VPS `sudo sed -i 's/^MASOI_TAG=.*/MASOI_TAG=/; /^MASOI_GAME_SERVER_IMAGE=/d; /^MASOI_WEB_IMAGE=/d' /var/lib/masoi-ci/image.env` và `./deploy/vps-shared/push.sh ops@… --build`.

## Bảo mật

- **Key CI không có shell:** `authorized_keys` của `masoi-ci` là `restrict,command="/usr/local/sbin/masoi-ci-deploy"` (root sở hữu, CI không sửa được). Lệnh duy nhất nhận được là một SHA 40 ký tự; mọi thứ khác bị từ chối. Lộ key thì cũng chỉ deploy được một commit đã có image do CI của repo build.
- **Quyền tối thiểu:** `masoi-ci` không ở nhóm `docker`, chỉ được `sudo` đúng `masoi-ci-deploy` (`/etc/sudoers.d/91-masoi-ci`). Không đụng user `ops`/`deploy` hay compose của Kestrel; chỉ dọn image của Ma Sói (giữ bản đang chạy + bản trước).
- **Không có token lâu dài trên VPS:** CI gửi `GITHUB_TOKEN` của job qua stdin (hết hạn khi job xong); VPS chỉ dùng nó trong một `DOCKER_CONFIG` tạm để pull rồi xoá.
- **Bí mật ứng dụng** chỉ nằm trên VPS (`/opt/masoi/.env.production`). GitHub chỉ giữ key CI.
- `compose.yml` trên VPS chỉ đổi qua `push.sh` (user `ops`), không qua CI → push code không thay đổi được cấu hình hạ tầng.

## Trên VPS

| Đường dẫn | Nội dung |
|---|---|
| `/usr/local/sbin/masoi-ci-deploy` | = `deploy/vps-shared/ci-deploy.sh` (cài lại bằng `setup-cicd.sh` khi sửa) |
| `/var/lib/masoi-ci/image.env` | `MASOI_IMAGE`, `MASOI_TAG` (commit đang chạy), `MASOI_GAME_SERVER_IMAGE`, `MASOI_WEB_IMAGE`; `previous-tag` = bản trước |
| `/home/masoi-ci/.ssh/authorized_keys` | key CI + `restrict,command=…` |

Chạy tay (vd. quay về bản trước còn trên máy): `ssh ops@147.93.182.84 'sudo masoi-ci-deploy $(sudo cat /var/lib/masoi-ci/previous-tag)'`.

## Xử lý sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| Deploy bị bỏ qua (skipped) | `DEPLOY_ENABLED` phải là `true`; CI của commit đó phải xanh và là push lên `main` |
| `Chưa có ghcr.io/…:<sha>` | Commit chưa qua CI trên main (chạy tay với SHA của PR/nhánh khác) |
| `Host key verification failed` | VPS đổi host key: cập nhật `VPS_KNOWN_HOSTS` (`ssh-keygen -F 147.93.182.84`) |
| `Permission denied (publickey)` | Chạy lại `./scripts/setup-cicd.sh ops@147.93.182.84` (cài lại key + `ci-install.sh`) |
| `không tải được …` | Mạng GHCR chập chờn → workflow tự thử lại 3 lần |
| `migration lỗi` / `quay về …` | `ssh ops@… 'cd /opt/masoi && sudo docker compose -f deploy/vps-shared/compose.yml --env-file .env.production --env-file /var/lib/masoi-ci/image.env logs --tail=200'` |
| `network workspaces_shared … not found`, `db:false` / `redis:false` | Hạ tầng dùng chung phía Kestrel — [DEPLOY_VPS_SHARED.md](DEPLOY_VPS_SHARED.md#xử-lý-sự-cố) |
| `Ma Sói đang dừng bảo trì` (exit 4) | Đúng ý: `maintenance.sh stop` đang chặn deploy. Xong bảo trì: `sudo /opt/masoi/deploy/vps-shared/maintenance.sh start`, rồi Actions → Deploy → Run workflow với SHA đó ([RUNBOOK_VPS.md](RUNBOOK_VPS.md)) |
| Smoke test đỏ nhưng VPS khoẻ | Cloudflare chặn bot (Bot Fight Mode / WAF) với IP GitHub → tắt cho `masoi.tiepdo.online` hoặc thêm rule bỏ qua `/api/health` |
