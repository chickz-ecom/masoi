#!/usr/bin/env bash
# Restore a dump produced by backup-db.sh:  ./scripts/restore-db.sh backups/masoi-YYYYmmdd-HHMMSS.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: restore-db.sh <dump.sql.gz>}"
ENV_FILE="${ENV_FILE:-.env.production}"
set -a; . "$ENV_FILE"; set +a
echo "This will overwrite database ${POSTGRES_DB:-masoi}. Type 'yes' to continue:"
read -r answer; [ "$answer" = "yes" ] || exit 1
docker compose --env-file "$ENV_FILE" stop game-server web
gunzip -c "$FILE" | docker compose --env-file "$ENV_FILE" exec -T postgres psql -U "${POSTGRES_USER:-masoi}" -d "${POSTGRES_DB:-masoi}"
docker compose --env-file "$ENV_FILE" start game-server web
