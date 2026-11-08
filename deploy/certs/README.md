# deploy/certs — chứng chỉ Cloudflare Origin (KHÔNG commit)

Mọi file trong thư mục này (trừ README) bị loại khỏi git, khỏi `rsync` lên VPS và khỏi Docker build context.

| File | Nội dung (Cloudflare → `tiepdo.online` → SSL/TLS → Origin Server → Create Certificate) |
|---|---|
| `masoi.pem` | ô **Origin Certificate** |
| `masoi.key` | ô **Private Key** (chỉ hiện một lần) |
| `masoi-ci`, `masoi-ci.pub` | key SSH của GitHub Actions (do `scripts/setup-cicd.sh` tạo; bản private nằm trong secret `VPS_SSH_KEY`) |

Cài lên VPS: `./deploy/vps-shared/push.sh ops@<IP> --domain masoi.tiepdo.online --cert masoi` tự cài nếu thấy hai file trên; hoặc riêng lẻ `./deploy/vps-shared/install-cert.sh ops@<IP>`.
