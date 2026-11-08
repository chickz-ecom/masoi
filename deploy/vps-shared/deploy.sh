#!/usr/bin/env bash
# Chạy trên VPS, trong /opt/masoi (push.sh gọi script này):
#   sudo ./deploy/vps-shared/deploy.sh           ÁP DỤNG CẤU HÌNH (compose.yml / .env.production): không build, không pull,
#                                                giữ đúng image đang chạy. Thiếu image hoặc image khác → dừng.
#   sudo ./deploy/vps-shared/deploy.sh --build   DEPLOY PHIÊN BẢN APP từ mã nguồn trong /opt/masoi (chỉ khi CHƯA bật
#                                                CI/CD): build → migration → khởi động → health; lỗi → quay về image trước.
# Đã bật CI/CD (docs/CICD.md): phiên bản app lên bằng `git push`; image đang chạy ghi ở /var/lib/masoi-ci/image.env.
# Database/Redis chung với Kestrel (MASOI_POSTGRES_HOST / MASOI_REDIS_HOST); MASOI_DB_MODE=private = cấu hình cũ.
# Trận đang chơi không mất (state trong Postgres, timer khôi phục khi game-server lên lại; client tự kết nối lại).
set -euo pipefail
MODE=config
case "${1:-}" in
  "" | --config) ;;
  --build) MODE=build ;;
  *) echo "Dùng: sudo ./deploy/vps-shared/deploy.sh [--build]" >&2; exit 2 ;;
esac
cd "${MASOI_DIR:-/opt/masoi}"
[[ -f .env.production ]] || { echo "Thiếu /opt/masoi/.env.production (xem deploy/vps-shared/env.production.example)" >&2; exit 1; }
env_val() { sed -n "s/^$1=//p" "$2" | tail -n 1 | tr -d "\"'"; }
DOMAIN="$(env_val DOMAIN .env.production)"
GAME_PORT="$(env_val MASOI_GAME_PORT .env.production)"; GAME_PORT="${GAME_PORT:-4100}"
WEB_PORT="$(env_val MASOI_WEB_PORT .env.production)"; WEB_PORT="${WEB_PORT:-3100}"
DB_MODE="$(env_val MASOI_DB_MODE .env.production)"; DB_MODE="${DB_MODE:-shared}"
CI_ENV="${MASOI_CI_STATE:-/var/lib/masoi-ci}/image.env"
CI_TAG=""
[[ -f "$CI_ENV" ]] && CI_TAG="$(env_val MASOI_TAG "$CI_ENV")"

COMPOSE=(docker compose -f deploy/vps-shared/compose.yml)
case "$DB_MODE" in
  shared) ;;
  private)
    COMPOSE+=(-f deploy/vps-shared/compose.private-db.yml)
    echo "!! MASOI_DB_MODE=private: dùng Postgres/Redis RIÊNG cũ (compose.private-db.yml), không phải database chung" ;;
  *) echo "MASOI_DB_MODE không hợp lệ: $DB_MODE (shared | private)" >&2; exit 2 ;;
esac
COMPOSE+=(--env-file .env.production)
# Image sẽ dùng — khớp với mặc định trong compose.yml. Deploy tay giữ đúng tên image đã chạy trước khi có CI/CD.
GS_IMG=masoi-game-server:latest WEB_IMG=masoi-web:latest
if [[ "$CI_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  COMPOSE+=(--env-file "$CI_ENV")
  GS_IMG="$(env_val MASOI_GAME_SERVER_IMAGE "$CI_ENV")"
  WEB_IMG="$(env_val MASOI_WEB_IMAGE "$CI_ENV")"
fi

exec 9>.deploy.lock
flock -n 9 || { echo "Đang có một lần deploy khác chạy" >&2; exit 3; }
# Đang bảo trì (deploy/vps-shared/maintenance.sh stop): không deploy, không bật lại game-server.
[[ ! -e .maintenance ]] || { echo "!! Ma Sói đang dừng bảo trì ($(cat .maintenance)) — bật lại: sudo ./deploy/vps-shared/maintenance.sh start" >&2; exit 4; }

wait_ok() {
  for _ in $(seq 1 45); do
    if curl -fs -o /dev/null "$1"; then return 0; fi
    sleep 2
  done
  return 1
}
healthy() {
  wait_ok "http://127.0.0.1:$GAME_PORT/api/health" || { echo "!! game-server chưa khoẻ: ${COMPOSE[*]} logs --tail=100 game-server" >&2; return 1; }
  wait_ok "http://127.0.0.1:$WEB_PORT/" || { echo "!! web chưa khoẻ: ${COMPOSE[*]} logs --tail=100 web" >&2; return 1; }
}
image_id() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null || true; }
running_image() {
  local cid
  cid="$("${COMPOSE[@]}" ps -q "$1" 2>/dev/null | head -n 1)"
  [[ -n "$cid" ]] && docker inspect -f '{{.Image}}' "$cid" 2>/dev/null || true
}

# ---------------------------------------------------------------- áp dụng cấu hình
if [[ "$MODE" == config ]]; then
  if [[ "$CI_TAG" =~ ^[0-9a-f]{40}$ ]]; then echo "== áp dụng cấu hình — CI/CD đang bật, image ${CI_TAG:0:7}"
  else echo "== áp dụng cấu hình — image deploy tay $GS_IMG, $WEB_IMG"; fi
  missing=()
  for img in $("${COMPOSE[@]}" config --images | sort -u); do
    [[ -n "$(image_id "$img")" ]] || missing+=("$img")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "!! thiếu image trên máy: ${missing[*]} — áp dụng cấu hình không build, không pull." >&2
    echo "   Deploy phiên bản app: git push (CI/CD) hoặc sudo ./deploy/vps-shared/deploy.sh --build" >&2
    exit 1
  fi
  # Container đang chạy phải dùng đúng image đó, nếu không "áp dụng cấu hình" sẽ lặng lẽ đổi phiên bản app.
  for pair in "game-server=$GS_IMG" "web=$WEB_IMG"; do
    svc="${pair%%=*}" img="${pair#*=}"
    now="$(running_image "$svc")" want="$(image_id "$img")"
    if [[ -n "$now" && "$now" != "$want" && -z "${MASOI_ALLOW_IMAGE_CHANGE:-}" ]]; then
      echo "!! $svc đang chạy image ${now:7:12}, nhưng $img là ${want:7:12} → áp dụng cấu hình sẽ đổi phiên bản app." >&2
      echo "   Dừng. Chắc chắn muốn đổi: sudo MASOI_ALLOW_IMAGE_CHANGE=1 ./deploy/vps-shared/deploy.sh" >&2
      exit 1
    fi
    [[ -n "$now" ]] && echo "   $svc: giữ image ${want:7:12} ($img)"
  done
  "${COMPOSE[@]}" up -d --no-build --pull never
  echo "== health"
  healthy || { echo "!! cấu hình mới chưa chạy được — xem docs/DEPLOY_VPS_SHARED.md (Quay lại cấu hình cũ)" >&2; exit 1; }
  echo "== OK (cấu hình) — https://${DOMAIN}"
  exit 0
fi

# ---------------------------------------------------------------- --build: deploy tay một phiên bản mới
if [[ "$CI_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "!! CI/CD đang bật (image ${CI_TAG:0:7}): deploy phiên bản bằng git push hoặc workflow Deploy." >&2
  echo "   Image build tay sẽ không được dùng. Chỉ áp dụng cấu hình: sudo ./deploy/vps-shared/deploy.sh" >&2
  exit 2
fi
# Giữ image hiện tại ở :previous để quay về; bản :previous cũ hơn được xoá khi deploy xong.
stale=()
had_previous=""
for img in "$GS_IMG" "$WEB_IMG"; do
  name="${img%:*}"
  old_prev="$(image_id "$name:previous")"
  if [[ -n "$(image_id "$img")" ]]; then
    docker tag "$img" "$name:previous"
    had_previous=1
    [[ -n "$old_prev" && "$old_prev" != "$(image_id "$img")" ]] && stale+=("$old_prev")
  fi
done
restore_previous() {
  echo "!! $1" >&2
  [[ -n "$had_previous" ]] || { echo "!! chưa có image trước để quay về: ${COMPOSE[*]} logs --tail=200" >&2; exit 1; }
  for img in "$GS_IMG" "$WEB_IMG"; do
    [[ -n "$(image_id "${img%:*}:previous")" ]] && docker tag "${img%:*}:previous" "$img"
  done
  echo "!! quay về image trước" >&2
  # --no-deps: không chạy lại migrate (bản cũ chạy được trên schema mới vì migration chỉ thêm).
  if "${COMPOSE[@]}" up -d --no-build --pull never --no-deps game-server web && healthy; then
    echo "!! đã quay về image trước, đang chạy bình thường" >&2
  fi
  exit 1
}

echo "== build images"
"${COMPOSE[@]}" build --pull || restore_previous "build lỗi"
# `up` chạy migrate trước (depends_on): migration lỗi → game-server/web không bị thay, vẫn chạy bản cũ.
echo "== up (migrate → game-server → web)"
"${COMPOSE[@]}" up -d --no-build --pull never || restore_previous "migration / khởi động lỗi"
echo "== health"
healthy || restore_previous "bản mới chưa khoẻ"

for id in ${stale[@]+"${stale[@]}"}; do docker rmi "$id" >/dev/null 2>&1 || true; done
echo "== OK (phiên bản mới; bản trước giữ ở masoi-game-server:previous, masoi-web:previous) — https://${DOMAIN}"
