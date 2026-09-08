#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "Usage: $0 backup.sql" >&2; exit 2; }
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$1"
