#!/usr/bin/env bash
# CI/CD — cài phía VPS, một lần (scripts/setup-cicd.sh gọi qua ssh ops@…; chạy lại an toàn):
#   sudo bash /opt/masoi/deploy/vps-shared/ci-install.sh ghcr.io/<owner>/<repo> < masoi-ci.pub
# - user masoi-ci (không mật khẩu, không nhóm docker): đúng một key, khoá vào /usr/local/sbin/masoi-ci-deploy
# - sudoers: masoi-ci chỉ được sudo đúng script đó (root:root, không ai khác sửa được)
# - /var/lib/masoi-ci/image.env: MASOI_IMAGE (+ MASOI_TAG, MASOI_GAME_SERVER_IMAGE, MASOI_WEB_IMAGE do mỗi lần deploy ghi).
#   Lúc mới cài MASOI_TAG rỗng → compose vẫn dùng image deploy tay đang chạy (masoi-*:latest) cho tới lần CI deploy đầu.
# Không đụng user ops / deploy hay bất cứ gì của Kestrel.
set -euo pipefail
IMAGE="${1:?Dùng: sudo bash ci-install.sh ghcr.io/<owner>/<repo> < masoi-ci.pub}"
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE=/var/lib/masoi-ci
[[ $EUID -eq 0 ]] || { echo "Cần chạy bằng sudo" >&2; exit 1; }
[[ "$IMAGE" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+$ ]] || { echo "Image không hợp lệ (cần chữ thường): $IMAGE" >&2; exit 2; }
IFS= read -r KEY || true
[[ "$KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/]+=*(\ [^\"]*)?$ ]] || { echo "Cần public key ssh-ed25519 qua stdin" >&2; exit 2; }

echo "== user masoi-ci"
id masoi-ci &>/dev/null || adduser --disabled-password --gecos "" --shell /bin/bash masoi-ci >/dev/null
# .ssh thuộc root: CI không sửa được key / lệnh của chính nó.
install -d -m 755 -o root -g root /home/masoi-ci/.ssh
printf 'restrict,command="/usr/local/sbin/masoi-ci-deploy" %s\n' "$KEY" >/home/masoi-ci/.ssh/authorized_keys
chown root:root /home/masoi-ci/.ssh/authorized_keys
chmod 644 /home/masoi-ci/.ssh/authorized_keys

echo "== /usr/local/sbin/masoi-ci-deploy + sudoers"
install -m 755 -o root -g root "$HERE/ci-deploy.sh" /usr/local/sbin/masoi-ci-deploy
tmp="$(mktemp)"
echo 'masoi-ci ALL=(root) NOPASSWD: /usr/local/sbin/masoi-ci-deploy' >"$tmp"
visudo -cqf "$tmp" || { rm -f "$tmp"; echo "sudoers không hợp lệ" >&2; exit 1; }
install -m 440 -o root -g root "$tmp" /etc/sudoers.d/91-masoi-ci
rm -f "$tmp"

echo "== $STATE/image.env"
install -d -m 700 -o root -g root "$STATE"
if [[ -f "$STATE/image.env" ]]; then
  sed -i "s#^MASOI_IMAGE=.*#MASOI_IMAGE=$IMAGE#" "$STATE/image.env"
else
  printf 'MASOI_IMAGE=%s\nMASOI_TAG=\n' "$IMAGE" >"$STATE/image.env"
fi
chmod 600 "$STATE/image.env"
echo "== OK — key CI chỉ chạy được: masoi-ci-deploy <sha>"
