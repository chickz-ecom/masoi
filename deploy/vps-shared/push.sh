#!/usr/bin/env bash
# Chạy trên MÁY DEV: đồng bộ mã nguồn lên VPS rồi deploy.
#   Lần đầu:   ./deploy/vps-shared/push.sh ops@<IP-VPS> --domain masoi.example.com [--cert masoi]
#              (--cert masoi: cài luôn deploy/certs/masoi.pem + masoi.key nếu có)
#   Về sau:    ./deploy/vps-shared/push.sh ops@<IP-VPS>
# File chỉ có trên VPS (.env.production, backups/) không bị xoá vì nằm trong danh sách exclude.
set -euo pipefail
TARGET="${1:?Dùng: ./deploy/vps-shared/push.sh ops@<IP-VPS> [--domain <domain>] [--cert <name>]}"
shift
DOMAIN="" CERT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --cert) CERT="$2"; shift 2 ;;
    *) echo "Tham số lạ: $1" >&2; exit 2 ;;
  esac
done
DIR="${MASOI_DIR:-/opt/masoi}"
cd "$(dirname "$0")/../.."

echo "== thư mục $DIR trên VPS"
ssh "$TARGET" "sudo install -d -o \$(id -un) -g \$(id -gn) $DIR"

echo "== đồng bộ mã nguồn"
rsync -az --delete --stats \
  --exclude '.git/' --exclude 'node_modules/' --exclude '.next/' --exclude 'dist/' \
  --exclude '.env' --exclude '.env.production' --exclude 'backups/' --exclude '.deploy.lock' \
  --exclude 'apps/web/public/assets/**/_originals/' --exclude 'apps/web/public/assets/**/_generated/' \
  --exclude 'test-results/' --exclude 'playwright-report/' --exclude '.DS_Store' --exclude 'plan.md' \
  --exclude 'deploy/certs/' --exclude '*.pem' --exclude '*.key' \
  ./ "$TARGET:$DIR/"

if [[ -n "$CERT" && -f "deploy/certs/$CERT.pem" ]]; then
  echo "== chứng chỉ deploy/certs/$CERT.pem"
  ./deploy/vps-shared/install-cert.sh "$TARGET" "$CERT"
fi
if [[ -n "$DOMAIN" ]]; then
  ssh -t "$TARGET" "cd $DIR && sudo ./deploy/vps-shared/setup.sh '$DOMAIN' '$CERT'"
fi
ssh -t "$TARGET" "cd $DIR && sudo ./deploy/vps-shared/deploy.sh"
