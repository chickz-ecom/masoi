#!/usr/bin/env bash
# CI/CD — deploy một commit đã có image trên GHCR (docs/CICD.md). ci-install.sh cài file này vào
# /usr/local/sbin/masoi-ci-deploy (root:root 755). GitHub Actions gọi:
#   printf '%s\n%s\n' "$GITHUB_ACTOR" "$GITHUB_TOKEN" | ssh masoi-ci@<vps> <sha>
# - authorized_keys của user masoi-ci khoá key CI vào đúng script này (restrict,command=…): không shell, không forward;
#   SHA là "lệnh" duy nhất được gửi. Script tự sudo; sudoers chỉ cho masoi-ci chạy đúng file này.
# - Token GHCR = GITHUB_TOKEN của job (hết hạn khi job xong), đọc từ stdin, chỉ nằm trong một DOCKER_CONFIG tạm.
# - pull → migration → khởi động → health. Migration lỗi: giữ bản đang chạy. Lỗi sau khi đổi image: quay về bản trước
#   (lần CI đầu tiên: quay về image deploy tay masoi-game-server:latest / masoi-web:latest).
# - Database/Redis: chung với Kestrel theo .env.production (MASOI_DB_MODE=private = cấu hình cũ, compose.private-db.yml).
#   Không bật, không xoá container nào khác của project (không --remove-orphans).
# Chạy tay trên VPS (vd. quay về một image còn trên máy):  sudo masoi-ci-deploy <sha>
set -euo pipefail
SELF=/usr/local/sbin/masoi-ci-deploy
if [[ $EUID -ne 0 ]]; then exec sudo -n "$SELF" "${SSH_ORIGINAL_COMMAND:-${1:-}}"; fi

SHA="${1:-}"
if [[ "$SHA" == ping ]]; then echo "pong $(id -un)@$(hostname)"; exit 0; fi
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: masoi-ci-deploy <commit sha, 40 hex>" >&2; exit 2; }

DIR="${MASOI_DIR:-/opt/masoi}"
STATE="${MASOI_CI_STATE:-/var/lib/masoi-ci}"
IMAGE_ENV="$STATE/image.env"
cd "$DIR"
[[ -f .env.production && -f deploy/vps-shared/compose.yml ]] ||
  { echo "!! thiếu $DIR/.env.production hoặc compose.yml (chạy push.sh --domain trước)" >&2; exit 1; }
[[ -f "$IMAGE_ENV" ]] || { echo "!! thiếu $IMAGE_ENV (chạy ci-install.sh)" >&2; exit 1; }
MASOI_IMAGE="$(sed -n 's/^MASOI_IMAGE=//p' "$IMAGE_ENV")"
OLD="$(sed -n 's/^MASOI_TAG=//p' "$IMAGE_ENV")"
[[ "$MASOI_IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+$ ]] || { echo "!! MASOI_IMAGE không hợp lệ trong $IMAGE_ENV" >&2; exit 1; }
env_val() { local v; v="$(sed -n "s/^$1=//p" .env.production | tail -n 1 | tr -d "\"'")"; echo "${v:-$2}"; }
GAME_PORT="$(env_val MASOI_GAME_PORT 4100)"
WEB_PORT="$(env_val MASOI_WEB_PORT 3100)"
COMPOSE=(docker compose -f deploy/vps-shared/compose.yml)
case "$(env_val MASOI_DB_MODE shared)" in
  shared) ;;
  private) COMPOSE+=(-f deploy/vps-shared/compose.private-db.yml); echo "!! MASOI_DB_MODE=private (Postgres/Redis riêng cũ)" ;;
  *) echo "!! MASOI_DB_MODE không hợp lệ trong .env.production (shared | private)" >&2; exit 1 ;;
esac
COMPOSE+=(--env-file .env.production --env-file "$IMAGE_ENV")
# Image deploy tay (trước khi có CI/CD) — đích quay về khi lần CI đầu tiên lỗi.
LEGACY=(masoi-game-server:latest masoi-web:latest)

# Cùng khoá với deploy.sh (push.sh) → không chạy chồng nhau.
exec 9>.deploy.lock
flock -w 300 9 || { echo "!! đang có một lần deploy khác" >&2; exit 3; }
# Đang bảo trì (deploy/vps-shared/maintenance.sh stop): không deploy, không bật lại game-server.
[[ ! -e .maintenance ]] || { echo "!! Ma Sói đang dừng bảo trì ($(cat .maintenance)) — bật lại: sudo ./deploy/vps-shared/maintenance.sh start" >&2; exit 4; }

GH_USER="" GH_TOKEN=""
if [[ ! -t 0 ]]; then
  IFS= read -r -t 10 GH_USER || true
  IFS= read -r -t 10 GH_TOKEN || true
fi
DC="$(mktemp -d)"
trap 'rm -rf "$DC"' EXIT
if [[ -n "$GH_TOKEN" ]]; then
  printf '%s' "$GH_TOKEN" | docker --config "$DC" login ghcr.io -u "${GH_USER:-ci}" --password-stdin >/dev/null ||
    { echo "!! không tải được image: đăng nhập GHCR lỗi" >&2; exit 1; }
fi

echo "== image $MASOI_IMAGE/{game-server,web}:${SHA:0:7}"
for app in game-server web; do
  img="$MASOI_IMAGE/$app:$SHA"
  if ! docker image inspect "$img" >/dev/null 2>&1 && ! docker --config "$DC" pull -q "$img" >/dev/null; then
    echo "!! không tải được $img" >&2
    exit 1
  fi
done

# compose.yml đọc MASOI_GAME_SERVER_IMAGE / MASOI_WEB_IMAGE; tag rỗng = image deploy tay (LEGACY).
write_tag() {
  {
    printf 'MASOI_IMAGE=%s\nMASOI_TAG=%s\n' "$MASOI_IMAGE" "$1"
    [[ -z "$1" ]] || printf 'MASOI_GAME_SERVER_IMAGE=%s\nMASOI_WEB_IMAGE=%s\n' "$MASOI_IMAGE/game-server:$1" "$MASOI_IMAGE/web:$1"
  } >"$IMAGE_ENV.tmp"
  chmod 600 "$IMAGE_ENV.tmp"
  mv "$IMAGE_ENV.tmp" "$IMAGE_ENV"
}

wait_ok() {
  for _ in $(seq 1 45); do
    if curl -fs -o /dev/null "$1"; then return 0; fi
    sleep 2
  done
  return 1
}
healthy() { wait_ok "http://127.0.0.1:$GAME_PORT/api/health" && wait_ok "http://127.0.0.1:$WEB_PORT/"; }

rollback() {
  echo "!! $1" >&2
  if [[ "$OLD" =~ ^[0-9a-f]{40}$ && "$OLD" != "$SHA" ]]; then
    echo "!! quay về ${OLD:0:7}" >&2
    write_tag "$OLD"
  elif [[ -z "$OLD" ]] && docker image inspect "${LEGACY[@]}" >/dev/null 2>&1; then
    echo "!! quay về image deploy tay (${LEGACY[*]})" >&2
    write_tag ""
  else
    echo "!! không có bản trước để quay về: ${COMPOSE[*]} logs --tail=200" >&2
    exit 1
  fi
  # --no-deps: không chạy lại migrate (bản cũ chạy được trên schema mới vì migration chỉ thêm).
  if "${COMPOSE[@]}" up -d --no-build --pull never --no-deps game-server web && healthy; then
    echo "!! đã quay về bản trước, đang chạy bình thường" >&2
  else
    echo "!! bản trước cũng chưa khoẻ: ${COMPOSE[*]} logs --tail=200" >&2
  fi
  exit 1
}

write_tag "$SHA"
echo "== migration"
if ! "${COMPOSE[@]}" run --rm -T migrate; then
  write_tag "$OLD"
  echo "!! migration lỗi, giữ bản đang chạy" >&2
  exit 1
fi

echo "== khởi động game-server → web"
"${COMPOSE[@]}" up -d --no-build --pull never || rollback "khởi động lỗi"
healthy || rollback "chưa khoẻ sau khi khởi động"

[[ -n "$OLD" && "$OLD" != "$SHA" ]] && echo "$OLD" >"$STATE/previous-tag"
# Chỉ dọn image của Ma Sói (không đụng Kestrel): giữ bản đang chạy + bản trước để rollback nhanh.
for app in game-server web; do
  { docker images "$MASOI_IMAGE/$app" --format '{{.Tag}}' | grep -vx -e "$SHA" -e "${OLD:-none}" || true; } |
    while read -r tag; do docker rmi "$MASOI_IMAGE/$app:$tag" >/dev/null 2>&1 || true; done
done
# Image deploy tay (masoi-*:latest/previous) KHÔNG tự xoá: là đường lui khi tắt CI/CD. Xoá tay — docs/CICD.md.
echo "== OK ${SHA:0:7}"
