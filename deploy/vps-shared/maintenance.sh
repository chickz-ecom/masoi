#!/usr/bin/env bash
# Dừng / bật mọi thứ GHI vào database `masoi` và key Redis `ww:` — khi bảo trì Postgres/Redis chung (Kestrel) hoặc khi
# khôi phục database masoi (docs/RUNBOOK_VPS.md). Chạy trên VPS bằng user có sudo (ops):
#   sudo /opt/masoi/deploy/vps-shared/maintenance.sh stop ["lý do"]   dừng game-server, chặn mọi deploy (tay và CI)
#   sudo /opt/masoi/deploy/vps-shared/maintenance.sh start            migrate → bật game-server → chờ health → bỏ chặn
#   sudo /opt/masoi/deploy/vps-shared/maintenance.sh status           cờ bảo trì, container, health, kết nối Postgres
# game-server là process chạy lâu duy nhất nối Postgres/Redis. web (Next.js) không dùng DB/Redis nên vẫn chạy (người chơi
# thấy "đang kết nối lại"). migrate / db-tools chỉ chạy khi deploy / sao lưu: deploy bị chặn bởi cờ .maintenance.
# Không đổi image, không build, không tạo lại container (start dùng --no-recreate).
set -euo pipefail
cd "${MASOI_DIR:-/opt/masoi}"
ACTION="${1:-}"
FLAG=.maintenance
# shellcheck source=scripts/db-common.sh
. scripts/db-common.sh # COMPOSE (đúng file compose / chế độ DB / image CI), env_val, pg
GAME_PORT="$(env_val MASOI_GAME_PORT "$ENV_FILE")"; GAME_PORT="${GAME_PORT:-4100}"
HEALTH="http://127.0.0.1:$GAME_PORT/api/health"

case "$ACTION" in
  stop)
    printf 'since=%s by=%s reason=%s\n' "$(date -u +%FT%TZ)" "${SUDO_USER:-$(id -un)}" "${2:-bảo trì}" >"$FLAG"
    # Chờ lần deploy đang chạy (nếu có) xong; lần sau thấy cờ thì dừng.
    exec 9>.deploy.lock
    flock -w 300 9 || { echo "!! đang có deploy chạy quá 5 phút — thử lại" >&2; exit 3; }
    "${COMPOSE[@]}" stop game-server
    echo "== Ma Sói đã dừng ghi (game-server stopped, deploy bị chặn). Bật lại: sudo $0 start"
    ;;
  start)
    exec 9>.deploy.lock
    flock -w 300 9 || { echo "!! đang có deploy chạy — thử lại" >&2; exit 3; }
    # --no-recreate: giữ nguyên container / image / cấu hình đang có; migrate (depends_on) chạy trước game-server.
    "${COMPOSE[@]}" up -d --no-build --pull never --no-recreate game-server web
    for _ in $(seq 1 60); do
      if curl -fs -o /dev/null "$HEALTH"; then
        rm -f "$FLAG"
        echo "== Ma Sói chạy lại: $(curl -s "$HEALTH")"
        exit 0
      fi
      sleep 2
    done
    echo "!! game-server chưa khoẻ sau 120 s ($(curl -s "$HEALTH" || echo 'không trả lời')) — vẫn giữ cờ bảo trì." >&2
    echo "   Log: ${COMPOSE[*]} logs --tail=100 game-server" >&2
    exit 1
    ;;
  status)
    if [[ -e "$FLAG" ]]; then echo "bảo trì: CÓ ($(cat "$FLAG"))"; else echo "bảo trì: không"; fi
    "${COMPOSE[@]}" ps -a game-server web
    echo "health: $(curl -s -m 5 "$HEALTH" || echo 'không trả lời')"
    conns="$(pg psql -X -A -t -q -c "select count(*) from pg_stat_activity where usename = current_user and pid <> pg_backend_pid()" </dev/null 2>/dev/null || echo '? (Postgres không trả lời)')"
    echo "kết nối Postgres của role masoi (trừ lệnh kiểm này): $conns"
    ;;
  *)
    echo "Dùng: sudo $0 stop [\"lý do\"] | start | status" >&2
    exit 2
    ;;
esac
