#!/usr/bin/env bash
# Bật CI/CD một lần (chạy trên Mac, docs/CICD.md): sau đó `git push` lên main là tự deploy lên VPS.
#   ./scripts/setup-cicd.sh ops@<IP-VPS> [--repo <owner>/<tên>] [--url https://<domain>]
# Mặc định: repo = remote origin nếu đã có (vd. chickz-ecom/masoi), không thì repo private <tài khoản gh>/ma-soi;
#           url = https://<DOMAIN trong /opt/masoi/.env.production>.
# Yêu cầu: đã deploy lần đầu bằng push.sh --domain (có .env.production + Caddy), `gh auth login` (quyền repo, workflow),
#          repo đã có commit thì workflow + file deploy phải được commit trước (script kiểm tra).
#          Chạy SAU khi đã đồng bộ cấu hình production (push.sh) — bước 4 rsync file lên VPS.
# Các bước (chạy lại an toàn, bước đã xong thì bỏ qua):
#   1. git init + commit đầu tiên (chặn nếu có .env / chứng chỉ / khoá trong commit)
#   2. tạo repo GitHub private (chưa push)
#   3. key CI deploy/certs/masoi-ci (gitignore)
#   4. VPS: đồng bộ file, tạo user masoi-ci khoá vào masoi-ci-deploy (ci-install.sh), thử key
#   5. GitHub: secret VPS_SSH_KEY, biến VPS_HOST, VPS_KNOWN_HOSTS, APP_URL, DEPLOY_ENABLED=true
#   6. git push → CI → image → deploy
set -euo pipefail
TARGET="${1:?Dùng: ./scripts/setup-cicd.sh ops@<IP-VPS> [--repo owner/tên] [--url https://domain]}"
shift
REPO="" URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    *) echo "Tham số lạ: $1" >&2; exit 2 ;;
  esac
done
cd "$(dirname "$0")/.."
HOST="${TARGET#*@}"
KEY=deploy/certs/masoi-ci
# Dùng gh làm credential cho git push (không sửa cấu hình git toàn máy).
GIT_GH=(git -c credential.https://github.com.helper= -c 'credential.https://github.com.helper=!gh auth git-credential')

for c in git gh ssh scp ssh-keygen; do command -v "$c" >/dev/null || { echo "Thiếu lệnh $c" >&2; exit 1; }; done
gh auth status >/dev/null 2>&1 || { echo "Chạy 'gh auth login' trước" >&2; exit 1; }
origin_repo=""
if origin_url="$(git remote get-url origin 2>/dev/null)"; then
  origin_repo="$(sed -E 's#^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)##; s#\.git$##; s#/$##' <<<"$origin_url")"
fi
if [[ -z "$REPO" ]]; then REPO="${origin_repo:-$(gh api user -q .login)/ma-soi}"; fi
if [[ -n "$origin_repo" && "$origin_repo" != "$REPO" ]]; then
  echo "!! --repo $REPO khác origin ($origin_url) — image CI sẽ là ghcr.io/<origin>, dừng" >&2; exit 2
fi
IMAGE="ghcr.io/$(tr '[:upper:]' '[:lower:]' <<<"$REPO")"

echo "== 0. VPS"
ssh -o BatchMode=yes "$TARGET" 'test -f /opt/masoi/.env.production' ||
  { echo "Chưa có /opt/masoi/.env.production — deploy lần đầu: ./deploy/vps-shared/push.sh $TARGET --domain <domain> [--cert masoi]" >&2; exit 1; }
if [[ -z "$URL" ]]; then
  domain="$(ssh -o BatchMode=yes "$TARGET" "sed -n 's/^DOMAIN=//p' /opt/masoi/.env.production")"
  [[ -n "$domain" ]] || { echo "Không đọc được DOMAIN trên VPS — truyền --url" >&2; exit 1; }
  URL="https://$domain"
fi
echo "   repo $REPO · image $IMAGE/{game-server,web} · $URL"

echo "== 1. Git"
[[ -d .git ]] || git init -q -b main
if ! git rev-parse -q --verify HEAD >/dev/null; then
  git add -A
  bad="$(git diff --cached --name-only | grep -E '(^|/)\.env(\.production)?$|\.(pem|key)$|^deploy/certs/' | grep -vx 'deploy/certs/README.md' || true)"
  [[ -z "$bad" ]] || { git reset -q; echo "!! Có file bí mật sắp vào commit, dừng:" >&2; echo "$bad" >&2; exit 1; }
  big="$(git diff --cached --name-only -z | xargs -0 -I{} find {} -maxdepth 0 -size +50M 2>/dev/null || true)"
  [[ -z "$big" ]] || echo "   cảnh báo: file > 50MB (GitHub chặn > 100MB): $big"
  git commit -q -m "Ma Sói Online"
  echo "   commit đầu tiên $(git rev-parse --short HEAD) ($(git ls-files | wc -l | tr -d ' ') file)"
else
  echo "   repo đã có commit $(git rev-parse --short HEAD), giữ nguyên"
  # Lần push ở bước 6 chỉ đưa lên những gì ĐÃ commit: thiếu workflow / file deploy thì CI không chạy hoặc deploy sai.
  need=(.github/workflows/ci.yml .github/workflows/deploy.yml deploy/vps-shared/compose.yml deploy/vps-shared/ci-deploy.sh
    deploy/vps-shared/ci-install.sh deploy/vps-shared/deploy.sh)
  missing=()
  for f in "${need[@]}"; do git ls-files --error-unmatch "$f" >/dev/null 2>&1 || missing+=("$f"); done
  dirty="$(git status --porcelain -- .github deploy/vps-shared scripts)"
  if [[ ${#missing[@]} -gt 0 || -n "$dirty" ]]; then
    echo "!! CI/CD cần các file sau đã được commit (chưa có / còn sửa dở):" >&2
    [[ ${#missing[@]} -eq 0 ]] || printf '   %s\n' "${missing[@]}" >&2
    [[ -z "$dirty" ]] || sed 's/^/   /' <<<"$dirty" >&2
    echo "   → xem lại rồi commit (git add … && git commit), chạy lại script này." >&2
    exit 1
  fi
  other="$(git status --porcelain | wc -l | tr -d ' ')"
  [[ "$other" == 0 ]] || echo "   lưu ý: còn $other file chưa commit — sẽ KHÔNG lên VPS (CI build đúng commit được push)"
fi
branch="$(git branch --show-current)"
[[ "$branch" == main ]] || { echo "Đang ở nhánh $branch — CI/CD deploy từ main" >&2; exit 1; }

echo "== 2. GitHub repo $REPO"
if git remote get-url origin >/dev/null 2>&1; then
  echo "   origin = $(git remote get-url origin)"
elif gh repo view "$REPO" >/dev/null 2>&1; then
  git remote add origin "https://github.com/$REPO.git"
  echo "   repo đã có, thêm origin"
else
  gh repo create "$REPO" --private --source . --remote origin >/dev/null
  echo "   đã tạo repo private https://github.com/$REPO"
fi

echo "== 3. Key CI ($KEY, gitignore)"
if [[ -f "$KEY" ]]; then
  echo "   đã có"
else
  ssh-keygen -q -t ed25519 -N "" -C "masoi-ci@github-actions" -f "$KEY"
  echo "   đã tạo"
fi

echo "== 4. VPS: user masoi-ci → masoi-ci-deploy"
./deploy/vps-shared/push.sh "$TARGET" --sync-only >/dev/null
ssh -o BatchMode=yes "$TARGET" "sudo bash /opt/masoi/deploy/vps-shared/ci-install.sh '$IMAGE'" <"$KEY.pub"
pong="$(ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "$KEY" "masoi-ci@$HOST" ping </dev/null)"
[[ "$pong" == "pong root@"* ]] || { echo "!! Thử key CI thất bại: $pong" >&2; exit 1; }
echo "   thử key CI: $pong"

echo "== 5. GitHub secret + biến"
known="$(ssh-keygen -F "$HOST" 2>/dev/null | grep -v '^#' || true)"
[[ -n "$known" ]] || known="$(ssh-keyscan -t ed25519 "$HOST" 2>/dev/null)"
gh secret set VPS_SSH_KEY -R "$REPO" <"$KEY"
gh variable set VPS_HOST -R "$REPO" -b "$HOST"
gh variable set VPS_KNOWN_HOSTS -R "$REPO" -b "$known"
gh variable set APP_URL -R "$REPO" -b "$URL"
gh variable set DEPLOY_ENABLED -R "$REPO" -b true
echo "   VPS_SSH_KEY, VPS_HOST, VPS_KNOWN_HOSTS, APP_URL, DEPLOY_ENABLED=true"

echo "== 6. git push → CI → deploy"
"${GIT_GH[@]}" push -u origin main
echo "== OK — theo dõi: gh run watch -R $REPO   (hoặc https://github.com/$REPO/actions)"
echo "   Từ giờ: git push lên main là tự deploy lên $URL"
