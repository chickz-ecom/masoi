#!/usr/bin/env bash
# Chạy trên MÁY DEV: đồng bộ file lên /opt/masoi trên VPS rồi chạy deploy.sh ở đó.
#   ./deploy/vps-shared/push.sh ops@<IP> --dry-run   XEM TRƯỚC: file nào sẽ đổi / bị xoá, diff compose.yml — không đổi gì
#   ./deploy/vps-shared/push.sh ops@<IP>             ÁP DỤNG CẤU HÌNH (compose.yml, .env.production đã sửa tay trên VPS):
#                                                     đồng bộ file + deploy.sh — không build, giữ đúng image đang chạy
#   ./deploy/vps-shared/push.sh ops@<IP> --build     DEPLOY PHIÊN BẢN APP từ mã nguồn trên Mac (chỉ khi CHƯA bật CI/CD;
#                                                     đã bật thì phiên bản lên bằng `git push`)
#   ./deploy/vps-shared/push.sh ops@<IP> --sync-only chỉ đồng bộ file (+ setup.sh nếu có --domain), không chạy deploy.sh
#   Lần đầu (VPS mới): ... --domain masoi.example.com [--cert masoi] --build
#              (--cert masoi: cài luôn deploy/certs/masoi.pem + masoi.key nếu có)
# File chỉ có trên VPS (.env.production, backups/, cờ .maintenance) không bị xoá vì nằm trong danh sách exclude.
set -euo pipefail
TARGET="${1:?Dùng: ./deploy/vps-shared/push.sh ops@<IP-VPS> [--dry-run] [--build] [--sync-only] [--domain <domain>] [--cert <name>]}"
shift
DOMAIN="" CERT="" SYNC_ONLY="" BUILD="" DRY_RUN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --cert) CERT="$2"; shift 2 ;;
    --sync-only) SYNC_ONLY=1; shift ;;
    --build) BUILD=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Tham số lạ: $1" >&2; exit 2 ;;
  esac
done
DIR="${MASOI_DIR:-/opt/masoi}"
cd "$(dirname "$0")/../.."

RSYNC=(rsync -az --delete
  --exclude '.git/' --exclude 'node_modules/' --exclude '.next/' --exclude 'dist/'
  --exclude '.env' --exclude '.env.production' --exclude 'backups/' --exclude '.deploy.lock' --exclude '.maintenance'
  --exclude 'apps/web/public/assets/**/_originals/' --exclude 'apps/web/public/assets/**/_generated/'
  --exclude 'test-results/' --exclude 'playwright-report/' --exclude '.DS_Store' --exclude 'plan.md'
  --exclude 'deploy/certs/' --exclude '*.pem' --exclude '*.key')

if [[ -n "$DRY_RUN" ]]; then
  echo "== file sẽ đổi trên $TARGET:$DIR (*deleting = sẽ bị xoá; không gồm .env.production, backups/)"
  changes="$("${RSYNC[@]}" --dry-run --itemize-changes ./ "$TARGET:$DIR/")"
  grep -v '^\.d' <<<"$changes" || echo "   (không có gì khác)"
  f=deploy/vps-shared/compose.yml
  echo "== diff $f (VPS → bản này)"
  # shellcheck disable=SC2029 # $DIR, $f mở rộng ở máy dev là đúng ý.
  ssh "$TARGET" "cat $DIR/$f 2>/dev/null" | diff -u --label "VPS:$f" --label "local:$f" - "$f" && echo "   giống nhau"
  echo "== khoá trong .env.production trên VPS (chỉ tên, không đọc giá trị) so với env.production.example"
  keys='s/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p'
  # shellcheck disable=SC2029
  vps_keys="$(ssh "$TARGET" "sed -n '$keys' $DIR/.env.production | sort -u")"
  ex_keys="$(sed -n "$keys" deploy/vps-shared/env.production.example | sort -u)"
  for k in DOMAIN POSTGRES_PASSWORD; do
    grep -qx "$k" <<<"$vps_keys" || echo "   !! thiếu khoá bắt buộc: $k"
  done
  only_ex="$(comm -13 <(echo "$vps_keys") <(echo "$ex_keys") | tr '\n' ' ')"
  only_vps="$(comm -23 <(echo "$vps_keys") <(echo "$ex_keys") | tr '\n' ' ')"
  echo "   chưa có trên VPS (dùng mặc định của compose.yml): ${only_ex:-—}"
  echo "   chỉ có trên VPS: ${only_vps:-—}"
  echo "== dry-run xong, VPS không đổi gì"
  exit 0
fi

echo "== thư mục $DIR trên VPS"
# shellcheck disable=SC2029
ssh "$TARGET" "sudo install -d -o \$(id -un) -g \$(id -gn) $DIR"

echo "== đồng bộ mã nguồn"
"${RSYNC[@]}" --stats ./ "$TARGET:$DIR/"

if [[ -n "$CERT" && -f "deploy/certs/$CERT.pem" ]]; then
  echo "== chứng chỉ deploy/certs/$CERT.pem"
  ./deploy/vps-shared/install-cert.sh "$TARGET" "$CERT"
fi
if [[ -n "$DOMAIN" ]]; then
  # shellcheck disable=SC2029
  ssh -t "$TARGET" "cd $DIR && sudo ./deploy/vps-shared/setup.sh '$DOMAIN' '$CERT'"
fi
[[ -n "$SYNC_ONLY" ]] && { echo "== đã đồng bộ (--sync-only, không deploy)"; exit 0; }
# shellcheck disable=SC2029
ssh -t "$TARGET" "cd $DIR && sudo ./deploy/vps-shared/deploy.sh ${BUILD:+--build}"
