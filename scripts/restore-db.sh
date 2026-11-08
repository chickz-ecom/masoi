#!/usr/bin/env bash
# Khôi phục database Ma Sói từ một bản sao lưu — CHỈ database `masoi`, bằng role masoi (không superuser trên cụm chung):
#   cd /opt/masoi && sudo ./scripts/restore-db.sh backups/masoi-YYYYmmdd-HHMMSS.dump
# Nhận: .dump (pg_dump -Fc — backup-db.sh, bản cutover), .sql.gz / .sql (bản plain cũ).
# Các bước, lỗi ở bất kỳ đâu → dừng ngay:
#   1. kiểm tra file + đích (đúng database masoi / role masoi; cụm chung thì role không được là superuser)
#   2. gõ "masoi" để xác nhận (hoặc CONFIRM=masoi khi chạy không tương tác)
#   3. sao lưu hiện trạng → backups/masoi-prerestore-<giờ>.dump
#   4. dừng game-server + web → MỘT transaction: xoá schema public của database masoi, nạp bản sao lưu → COMMIT.
#      Lỗi giữa chừng → ROLLBACK, database giữ nguyên như trước; game-server + web được bật lại.
#   5. migrate (prisma migrate deploy) cho khớp phiên bản app đang chạy → bật lại game-server + web.
# Không dùng \connect, CREATE/DROP DATABASE → searchapp và database khác của cụm không thể bị đụng tới.
# Redis không bị xoá (dùng chung với Kestrel): timer được dựng lại từ Postgres khi game-server khởi động.
# VPS riêng (docker-compose.yml ở gốc): MASOI_STACK=standalone ./scripts/restore-db.sh <file>
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?Dùng: sudo ./scripts/restore-db.sh <backups/masoi-….dump | ….sql.gz>}"
[[ -f "$FILE" && -s "$FILE" ]] || { echo "!! không có file hoặc file rỗng: $FILE" >&2; exit 1; }
# shellcheck source=scripts/db-common.sh
. scripts/db-common.sh
umask 077

echo "== 1. kiểm tra"
case "$(head -c 5 "$FILE" | od -An -c | tr -d ' \n')" in
  PGDMP) FORMAT=custom ;;
  037213*) FORMAT=gzip ;;
  *) FORMAT=plain ;;
esac
echo "   file: $FILE ($FORMAT, $(du -h "$FILE" | cut -f1))"
sql_stream() {
  case "$FORMAT" in
    custom) pg pg_restore --no-owner --no-acl -f - <"$FILE" ;;
    gzip) gunzip -c "$FILE" ;;
    plain) cat "$FILE" ;;
  esac
}
if [[ "$FORMAT" == custom ]]; then
  pg pg_restore --list <"$FILE" >/dev/null || { echo "!! file .dump hỏng (pg_restore --list)" >&2; exit 1; }
else
  [[ "$FORMAT" != gzip ]] || gzip -t "$FILE" || { echo "!! file .gz hỏng" >&2; exit 1; }
  # Bản plain có thể chứa lệnh ra ngoài database masoi hoặc tự COMMIT giữa chừng → từ chối.
  bad="$(sql_stream | grep -niE '^\\(c|connect)([[:space:]]|$)|^(create|drop|alter)[[:space:]]+database[[:space:]]|^(begin|commit|rollback|end)[[:space:]]*;' | head -n 3 || true)"
  [[ -z "$bad" ]] || { echo "!! file có lệnh không được phép (đổi database / transaction riêng):" >&2; echo "$bad" >&2; exit 1; }
fi
check_target
if [[ "$STACK" == shared && "$DB_MODE" == shared && "$TARGET_SUPERUSER" == t ]]; then
  echo "!! role $DB_USER là superuser trên Postgres chung — dừng (khôi phục chỉ chạy bằng role không superuser)" >&2
  exit 1
fi

echo "== 2. xác nhận"
echo "   Toàn bộ dữ liệu hiện tại của database $DB_NAME sẽ bị THAY bằng $FILE (searchapp không bị đụng tới)."
answer="${CONFIRM:-}"
if [[ -z "$answer" ]]; then
  printf '   Gõ "%s" để tiếp tục: ' "$DB_NAME"
  read -r answer || true
fi
[[ "$answer" == "$DB_NAME" ]] || { echo "!! huỷ" >&2; exit 1; }

# Không chạy cùng lúc với deploy (deploy.sh / masoi-ci-deploy dùng chung khoá).
exec 9>.deploy.lock
flock -w 300 9 || { echo "!! đang có một lần deploy khác" >&2; exit 3; }

echo "== 3. sao lưu hiện trạng"
SAFETY="backups/masoi-prerestore-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p backups
dump_to "$SAFETY"
echo "   $SAFETY ($(du -h "$SAFETY" | cut -f1)) — khôi phục ngược: sudo ./scripts/restore-db.sh $SAFETY"

echo "== 4. khôi phục (một transaction)"
running="$("${COMPOSE[@]}" ps --services --status running 2>/dev/null | grep -xE 'game-server|web' | tr '\n' ' ' || true)"
restart_app() {
  # shellcheck disable=SC2086 # danh sách service tách theo khoảng trắng
  [[ -z "$running" ]] || "${COMPOSE[@]}" start $running >/dev/null || echo "!! bật lại lỗi: ${COMPOSE[*]} start $running" >&2
}
trap restart_app EXIT
# shellcheck disable=SC2086
[[ -z "$running" ]] || "${COMPOSE[@]}" stop $running
# COMMIT chỉ được gửi khi cả bản sao lưu đã đọc xong không lỗi; psql dừng ở lỗi SQL đầu tiên (ON_ERROR_STOP).
# Thiếu COMMIT → psql thoát giữa transaction → Postgres ROLLBACK, database như trước bước 4.
if ! {
  printf 'SET client_min_messages = warning;\nBEGIN;\nDROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n'
  sql_stream | sed 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' || exit 1
  printf 'COMMIT;\n'
} | pg psql -X -q -v ON_ERROR_STOP=1 >/dev/null; then
  echo "!! khôi phục lỗi — đã ROLLBACK, database $DB_NAME giữ nguyên như trước. Bật lại app." >&2
  exit 1
fi
migrations="$(pg psql -X -A -t -q -c 'select count(*) from "_prisma_migrations"' </dev/null 2>/dev/null || echo "?")"
echo "   đã nạp ($migrations migration trong bản sao lưu)"

echo "== 5. migrate theo phiên bản app đang chạy → bật lại app"
"${COMPOSE[@]}" run --rm -T migrate </dev/null >/dev/null || { echo "!! migrate lỗi sau khi khôi phục: ${COMPOSE[*]} run --rm migrate" >&2; exit 1; }
trap - EXIT
restart_app
echo "== OK — database $DB_NAME đã khôi phục từ $FILE (bản trước khi khôi phục: $SAFETY)"
