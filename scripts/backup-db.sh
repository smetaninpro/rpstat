#!/usr/bin/env sh
set -eu
mkdir -p backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "backups/rmrp-$(date +%Y%m%d-%H%M%S).sql"
