#!/usr/bin/env bash
# Thiết lập lần đầu trên VPS (chạy trong /opt/masoi, cần sudo):
#   sudo ./deploy/vps-shared/setup.sh <domain> [cert-name]
#   - tạo .env.production (mật khẩu ngẫu nhiên cho role masoi trên Postgres chung) nếu chưa có
#   - thêm khối <domain> vào /etc/caddy/Caddyfile (sao lưu trước, validate, reload; lỗi → khôi phục)
#   cert-name: bỏ trống = dùng chứng chỉ Origin của Kestrel (`import origin_tls`);
#              "masoi" = dùng /etc/caddy/certs/masoi.pem + masoi.key (domain riêng).
# Chạy lại an toàn: bước đã làm thì bỏ qua.
set -euo pipefail
DOMAIN="${1:?Dùng: sudo ./deploy/vps-shared/setup.sh <domain> [cert-name]}"
CERT="${2:-}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
cd "${MASOI_DIR:-/opt/masoi}"

if [[ ! "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]]; then echo "Domain không hợp lệ: $DOMAIN" >&2; exit 2; fi

echo "== .env.production"
if [[ -f .env.production ]]; then
  echo "   đã có, giữ nguyên (DOMAIN hiện tại: $(sed -n 's/^DOMAIN=//p' .env.production))"
else
  cp deploy/vps-shared/env.production.example .env.production
  sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env.production
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env.production
  chmod 600 .env.production
  owner=$(stat -c '%U' .); chown "$owner:$owner" .env.production 2>/dev/null || true
  echo "   đã tạo (mật khẩu role masoi ngẫu nhiên). Postgres chung cần role + database masoi với đúng mật khẩu này:"
  echo "   docs/DEPLOY_VPS_SHARED.md → \"Hạ tầng dùng chung\" (làm cùng phía Kestrel)"
fi

echo "== Caddy ($CADDYFILE)"
if grep -qE "^${DOMAIN//./\\.}[[:space:]]*\{" "$CADDYFILE"; then
  echo "   đã có khối $DOMAIN, bỏ qua"
else
  if [[ -n "$CERT" ]]; then
    for f in "/etc/caddy/certs/$CERT.pem" "/etc/caddy/certs/$CERT.key"; do
      [[ -f "$f" ]] || { echo "Thiếu $f (Cloudflare → SSL/TLS → Origin Server → Create Certificate)" >&2; exit 1; }
    done
  elif ! grep -q '(origin_tls)' "$CADDYFILE"; then
    echo "Caddyfile không có snippet (origin_tls) — truyền cert-name cho domain riêng" >&2; exit 1
  fi
  backup="$CADDYFILE.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$CADDYFILE" "$backup"
  {
    echo
    sed -n '/^masoi\.example\.com {/,$p' deploy/vps-shared/Caddyfile.masoi |
      sed "s/^masoi\.example\.com {/$DOMAIN {/" |
      if [[ -n "$CERT" ]]; then sed "s#^\timport origin_tls#\ttls /etc/caddy/certs/$CERT.pem /etc/caddy/certs/$CERT.key#"; else cat; fi
  } >>"$CADDYFILE"
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "   đã thêm $DOMAIN và reload Caddy (bản sao lưu: $backup)"
  else
    cp "$CADDYFILE" "$CADDYFILE.failed"
    cp "$backup" "$CADDYFILE"
    echo "!! Caddyfile mới không hợp lệ — đã khôi phục bản cũ (bản lỗi: $CADDYFILE.failed). Chi tiết:" >&2
    caddy validate --config "$CADDYFILE.failed" --adapter caddyfile 2>&1 | tail -5 >&2 || true
    exit 1
  fi
fi
echo "== OK — tiếp theo (VPS mới, chưa có image): sudo ./deploy/vps-shared/deploy.sh --build"
