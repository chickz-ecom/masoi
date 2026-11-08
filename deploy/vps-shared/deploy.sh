#!/usr/bin/env bash
# Build + chạy Ma Sói trên VPS (chạy trên VPS, trong /opt/masoi):  sudo ./deploy/vps-shared/deploy.sh
# build image → migrate (tự chạy trong `up`) → khởi động → chờ health. Trận đang chơi không mất (state trong Postgres,
# timer khôi phục khi game-server lên lại; client tự kết nối lại).
set -euo pipefail
cd "${MASOI_DIR:-/opt/masoi}"
[[ -f .env.production ]] || { echo "Thiếu /opt/masoi/.env.production (xem deploy/vps-shared/env.production.example)" >&2; exit 1; }
set -a; . ./.env.production; set +a
COMPOSE=(docker compose -f deploy/vps-shared/compose.yml --env-file .env.production)

exec 9>.deploy.lock
flock -n 9 || { echo "Đang có một lần deploy khác chạy" >&2; exit 3; }

echo "== build images"
"${COMPOSE[@]}" build --pull

echo "== up (migrate → game-server → web)"
"${COMPOSE[@]}" up -d --remove-orphans

wait_ok() {
  local url=$1
  for _ in $(seq 1 45); do
    if curl -fsS -o /dev/null "$url"; then return 0; fi
    sleep 2
  done
  return 1
}
echo "== health"
wait_ok "http://127.0.0.1:${MASOI_GAME_PORT:-4100}/api/health" || { echo "!! game-server chưa khoẻ: ${COMPOSE[*]} logs --tail=100 game-server" >&2; exit 1; }
wait_ok "http://127.0.0.1:${MASOI_WEB_PORT:-3100}/" || { echo "!! web chưa khoẻ: ${COMPOSE[*]} logs --tail=100 web" >&2; exit 1; }

docker image prune -f >/dev/null || true
echo "== OK — https://${DOMAIN}"
