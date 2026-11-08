#!/usr/bin/env bash
# Daily PostgreSQL backup for the production stack (keeps the last 14 dumps).
# Cron example (as the deploy user):
#   15 3 * * * cd /opt/masoi && ./scripts/backup-db.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.production}"
set -a; . "$ENV_FILE"; set +a
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/masoi-${STAMP}.sql.gz"
docker compose --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-masoi}" -d "${POSTGRES_DB:-masoi}" --no-owner --format=plain | gzip -9 > "$OUT"
echo "[$(date -Is)] backup written: $OUT ($(du -h "$OUT" | cut -f1))"
ls -1t backups/masoi-*.sql.gz | tail -n +15 | xargs -r rm --
