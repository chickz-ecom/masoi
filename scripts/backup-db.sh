#!/usr/bin/env bash
# Sao lưu database Ma Sói — CHỈ database `masoi` (role masoi), không đụng searchapp hay database khác của cụm chung.
#   VPS dùng chung Kestrel:  cd /opt/masoi && sudo ./scripts/backup-db.sh
#   → backups/masoi-YYYYmmdd-HHMMSS.dump (pg_dump -Fc --no-owner --no-acl, kiểm tra bằng pg_restore --list), giữ 14 bản.
#   Cron (sudo crontab -e):  20 3 * * * cd /opt/masoi && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#   VPS riêng (docker-compose.yml ở gốc):  MASOI_STACK=standalone ./scripts/backup-db.sh
# Kestrel cũng dump database masoi mỗi đêm vào /opt/kestrel/backups (deploy/vps/backup.sh của Search app); bản ở đây để
# Ma Sói tự khôi phục được bằng scripts/restore-db.sh. Chỉ đọc: không khoá ghi, game vẫn chạy trong lúc dump.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/db-common.sh
. scripts/db-common.sh
KEEP="${BACKUP_KEEP:-14}"
umask 077
mkdir -p backups
OUT="backups/masoi-$(date +%Y%m%d-%H%M%S).dump"

echo "[$(date '+%F %T')] backup database $DB_NAME"
check_target
dump_to "$OUT"
echo "[$(date '+%F %T')] backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Chỉ xoay vòng bản tự động (masoi-<ngày>.dump); bản trước khi khôi phục (masoi-prerestore-*) và bản cũ .sql.gz giữ nguyên.
find backups -maxdepth 1 -type f -name 'masoi-[0-9]*.dump' | sort -r | tail -n +"$((KEEP + 1))" |
  while read -r old; do rm -f -- "$old"; done
