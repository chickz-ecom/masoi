#!/usr/bin/env bash
# Chạy trên MÁY DEV: cài Cloudflare Origin Certificate (domain riêng) lên VPS cho Caddy.
#   ./deploy/vps-shared/install-cert.sh ops@<IP-VPS> [tên=masoi]
#   đọc deploy/certs/<tên>.pem + <tên>.key (gitignore, không rsync, không vào Docker image)
#   → /etc/caddy/certs/<tên>.pem + <tên>.key trên VPS (root:caddy, 640).
# push.sh ... --cert <tên> tự gọi script này khi có file trong deploy/certs/.
# Kiểm tra trước khi gửi: đúng là chứng chỉ, khoá khớp chứng chỉ. Không in nội dung khoá.
set -euo pipefail
TARGET="${1:?Dùng: ./deploy/vps-shared/install-cert.sh ops@<IP-VPS> [tên]}"
NAME="${2:-masoi}"
[[ "$NAME" =~ ^[a-z0-9_-]+$ ]] || { echo "Tên không hợp lệ: $NAME" >&2; exit 2; }
CERT_DIR="${CERT_DIR:-$(cd "$(dirname "$0")/../certs" && pwd)}"
PEM="$CERT_DIR/$NAME.pem"
KEY="$CERT_DIR/$NAME.key"
for f in "$PEM" "$KEY"; do
  [[ -f "$f" ]] || { echo "Thiếu $f (Cloudflare → SSL/TLS → Origin Server → Create Certificate)" >&2; exit 1; }
done

echo "== kiểm tra chứng chỉ $PEM"
openssl x509 -in "$PEM" -noout -subject -enddate -ext subjectAltName ||
  { echo "$PEM không phải chứng chỉ PEM" >&2; exit 1; }
cert_pub=$(openssl x509 -in "$PEM" -noout -pubkey | openssl sha256)
key_pub=$(openssl pkey -in "$KEY" -pubout 2>/dev/null | openssl sha256) ||
  { echo "$KEY không phải khoá riêng PEM" >&2; exit 1; }
[[ "$cert_pub" == "$key_pub" ]] || { echo "Khoá không khớp với chứng chỉ" >&2; exit 1; }
echo "   khoá khớp chứng chỉ"

echo "== cài lên $TARGET:/etc/caddy/certs/$NAME.{pem,key}"
tmp=$(ssh "$TARGET" 'mktemp -d')
scp -q "$PEM" "$TARGET:$tmp/c.pem"
scp -q "$KEY" "$TARGET:$tmp/c.key"
ssh "$TARGET" "{ sudo test -d /etc/caddy/certs || sudo install -d -m 750 -o root -g caddy /etc/caddy/certs; } \
  && sudo install -m 640 -o root -g caddy $tmp/c.pem /etc/caddy/certs/$NAME.pem \
  && sudo install -m 640 -o root -g caddy $tmp/c.key /etc/caddy/certs/$NAME.key; rc=\$?; rm -rf $tmp; exit \$rc"
echo "== OK"
