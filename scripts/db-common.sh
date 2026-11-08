# shellcheck shell=bash
# Dùng chung cho scripts/backup-db.sh và scripts/restore-db.sh (source, không chạy trực tiếp). Chạy từ gốc repo.
# Đích luôn là database `masoi` bằng role `masoi`:
#   MASOI_STACK=shared (mặc định) — VPS dùng chung Kestrel: deploy/vps-shared/compose.yml, service một lần `db-tools`
#       (client PostgreSQL 16) nối tới MASOI_POSTGRES_HOST (shared-postgres) qua mạng workspaces_shared.
#       MASOI_DB_MODE=private trong .env.production → Postgres riêng cũ (compose.private-db.yml).
#   MASOI_STACK=standalone — VPS riêng với docker-compose.yml ở gốc repo (Postgres riêng, service `postgres`).
# Không bao giờ dùng `\connect`, -C/--create, DROP DATABASE: không đụng được searchapp hay database khác.

# Cron cũ (docs trước đây) đặt COMPOSE_FILE=deploy/vps-shared/compose.yml: bỏ qua, file compose chọn tường minh dưới đây.
unset COMPOSE_FILE COMPOSE_PROFILES
# Container postgres/redis cũ (đã dừng, giữ để quay lại cấu hình cũ) là "orphan" của compose.yml: không cần cảnh báo ở đây.
export COMPOSE_IGNORE_ORPHANS=1
ENV_FILE="${ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "!! thiếu $ENV_FILE" >&2; exit 1; }
env_val() { sed -n "s/^$1=//p" "$2" | tail -n 1 | tr -d "\"'"; }
DB_NAME=masoi
DB_USER=masoi
STACK="${MASOI_STACK:-shared}"
case "$STACK" in
  shared)
    DB_MODE="$(env_val MASOI_DB_MODE "$ENV_FILE")"; DB_MODE="${DB_MODE:-shared}"
    COMPOSE=(docker compose -f deploy/vps-shared/compose.yml)
    case "$DB_MODE" in
      shared) DB_HOST="$(env_val MASOI_POSTGRES_HOST "$ENV_FILE")"; DB_HOST="${DB_HOST:-shared-postgres}" ;;
      private) COMPOSE+=(-f deploy/vps-shared/compose.private-db.yml); DB_HOST="postgres (riêng, MASOI_DB_MODE=private)" ;;
      *) echo "!! MASOI_DB_MODE không hợp lệ: $DB_MODE (shared | private)" >&2; exit 2 ;;
    esac
    COMPOSE+=(--env-file "$ENV_FILE")
    # Image CI/CD đang chạy (để chạy migrate đúng phiên bản sau khi khôi phục).
    CI_ENV="${MASOI_CI_STATE:-/var/lib/masoi-ci}/image.env"
    if [[ -e "$CI_ENV" ]]; then
      [[ -r "$CI_ENV" ]] || { echo "!! không đọc được $CI_ENV — chạy bằng sudo" >&2; exit 1; }
      if [[ "$(env_val MASOI_TAG "$CI_ENV")" =~ ^[0-9a-f]{40}$ ]]; then COMPOSE+=(--env-file "$CI_ENV"); fi
    fi
    pg() { "${COMPOSE[@]}" run --rm --no-deps -T db-tools "$@"; }
    ;;
  standalone)
    COMPOSE=(docker compose -f docker-compose.yml --env-file "$ENV_FILE")
    DB_NAME="$(env_val POSTGRES_DB "$ENV_FILE")"; DB_NAME="${DB_NAME:-masoi}"
    DB_USER="$(env_val POSTGRES_USER "$ENV_FILE")"; DB_USER="${DB_USER:-masoi}"
    DB_HOST="postgres (docker-compose.yml)"
    pg() { "${COMPOSE[@]}" exec -T -e PGUSER="$DB_USER" -e PGDATABASE="$DB_NAME" postgres "$@"; }
    ;;
  *) echo "!! MASOI_STACK không hợp lệ: $STACK (shared | standalone)" >&2; exit 2 ;;
esac

# In ra "<database>|<user>|<superuser t/f>|<phiên bản>" và dừng nếu không phải đúng database/role của Ma Sói.
check_target() {
  local info db user super ver
  info="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -c \
    "select current_database(), current_user, r.rolsuper, current_setting('server_version') from pg_roles r where r.rolname = current_user" \
    </dev/null)" || { echo "!! không kết nối được Postgres ($DB_HOST)" >&2; exit 1; }
  IFS='|' read -r db user super ver <<<"$info"
  if [[ "$db" != "$DB_NAME" || "$user" != "$DB_USER" ]]; then
    echo "!! đang nối tới database '$db' bằng role '$user', không phải $DB_NAME/$DB_USER — dừng" >&2
    exit 1
  fi
  # shellcheck disable=SC2034 # dùng trong restore-db.sh
  TARGET_SUPERUSER="$super"
  echo "   đích: database $db, role $user$([[ "$super" == t ]] && echo " (superuser)") @ $DB_HOST, PostgreSQL $ver"
}

# dump_to <file>: pg_dump định dạng custom của riêng database masoi, kiểm tra đọc được rồi mới đặt tên thật.
dump_to() {
  local out="$1" part="$1.part"
  rm -f "$part"
  if ! pg pg_dump -Fc --no-owner --no-acl </dev/null >"$part" || [[ ! -s "$part" ]]; then
    rm -f "$part"; echo "!! pg_dump lỗi" >&2; return 1
  fi
  if ! pg pg_restore --list <"$part" >/dev/null; then
    rm -f "$part"; echo "!! bản dump không đọc được (pg_restore --list)" >&2; return 1
  fi
  mv "$part" "$out"
}
