# RMRP UFSB Portal

Local Docker foundation for the RMRP UFSB internal portal. The repository intentionally begins with the first MVP milestone from `RMRP_UFSB_Portal_TZ.md`.

## Local startup

1. Copy `.env.example` to `.env` and replace every placeholder secret with a unique random value of 32+ bytes. Set `ALLOWED_DISCORD_GUILD_ID` before creating sources.
2. Start: `docker compose up -d --build`.
3. Apply the initial database migration: `docker compose exec backend npm run prisma:migrate --workspace=@rmrp/backend -- --name init`.
4. Create the first admin: `docker compose exec backend npm run admin:create --workspace=@rmrp/backend`. The command asks for login and password interactively.
5. Open `http://127.0.0.1:3000`.

## Collector login

Run `docker compose --profile auth up collector-auth` in a trusted local desktop session, then open `http://127.0.0.1:6080/vnc.html`. Complete Discord login manually in noVNC, then stop the container. The noVNC port binds only to localhost. The persistent browser profile is a Docker volume and must never be exported to Git, environment files, database records, or logs.

The regular collector has no PostgreSQL connection string or database client. It only obtains source configuration and sends raw messages through the signed internal backend API. Its normal adapter is read-only: it validates a direct channel URL, navigates to it, and reads DOM data. The source and tests prohibit Playwright APIs for clicks, typing, form filling, reactions, and any other Discord mutation. Manual credentials entry is allowed only in the separate `collector-auth` profile.

`COLLECTOR_ENABLED=false` is the safe default. The collector sends a degraded heartbeat but does not open Discord until this value is explicitly changed to `true` after a manual login has completed.

## Operational notes

- PostgreSQL and collector do not expose host ports.
- Backend and frontend bind only to `127.0.0.1`.
- `scripts/backup-db.sh` writes timestamped PostgreSQL dumps to `backups/`; restore with `scripts/restore-db.sh backups/<file>.sql`.
- Before a VPS deployment, keep the same Compose topology, bind public ports through Nginx only, use HTTPS, set production secrets in the host secret store, and never proxy `/api/internal/*` publicly.

## Current implementation boundary

Implemented: Docker topology, primary schema, health checks, local session login, RBAC gate, CSRF middleware, Discord source validation, signed collector configuration/message endpoint, raw-message deduplication, sequence parsing/conflict handling, and a minimal frontend entry page.

Not yet implemented: complete admin UI, employee/dictionary CRUD, dashboard data APIs, training parser, review queue UI/actions, materials, tests, complete rate limit/audit wiring, production Nginx configuration, and robust Discord DOM extraction. The collector adapter is explicitly read-only and its selectors live only in `apps/discord-collector/src/discord-selectors.ts`.
