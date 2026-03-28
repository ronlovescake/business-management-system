# Host-Neutral Deployment Guide

This repository is deployment-neutral. You can run it on Docker, a VPS, or a generic PaaS without keeping a vendor-specific manifest in the repo.

## Universal Checklist

- Use PostgreSQL. This app is not designed for SQLite or MySQL.
- Set the required production environment variables before build and before runtime:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`
- Make sure `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` use the real public HTTPS URL in production.
- Back up the database before the first production deployment and before every schema migration.
- Use `npm run db:deploy` as a deliberate step after backup, not as a hidden auto-start side effect.
- Verify the health endpoint after deployment: `GET /api/health`
- If your host needs a custom Playwright browser cache path, set `PLAYWRIGHT_BROWSERS_PATH`. Otherwise leave it unset.

## Docker Checklist

Files added for the generic Docker path:

- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `.dockerignore`

Host data root convention:

- Set `BMS_DATA_ROOT` in `.env.docker`
- Postgres live data is stored in `${BMS_DATA_ROOT}/postgres`
- Logical backups are stored in `${BMS_DATA_ROOT}/backup`

### Quick Start

1. Copy the example env file:

```bash
cp .env.docker.example .env.docker
```

2. Edit `.env.docker` with real values.

3. Prepare the host storage directories safely:

```bash
npm run docker:prepare-storage
```

4. Build and start the stack:

```bash
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

5. Wait for PostgreSQL to report healthy, then run the first-run bootstrap step:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker run --rm app npm run docker:bootstrap
```

The bootstrap command is idempotent for the bundled local stack. It:

- applies Prisma migrations
- seeds the initial Docker login users defined in `prisma/seeds/auth-users.js`

6. Verify health:

```bash
curl http://localhost:5000/api/health
```

### Migrating Existing Native PostgreSQL Data Into Docker

Safest approach: logical dump and restore. Do not copy raw PostgreSQL data files from a running native server into the Docker data directory.

1. Create a dump from the native PostgreSQL database:

```bash
npm run docker:backup:native-db -- business_management_db
```

2. Restore that dump into the Docker database:

```bash
npm run docker:restore:docker-db -- business_management_db-YYYYMMDD-HHMMSS.dump --confirm
```

The restore command:

- starts the Docker `db` service if needed
- stops the app container temporarily
- recreates the Docker target database
- restores the dump from `${BMS_DATA_ROOT}/backup`
- starts the app again

### Docker Notes

- The compose file includes PostgreSQL for a self-hosted full stack.
- If you use an external or managed PostgreSQL instance, point `DATABASE_URL` to that database and skip the bundled `db` service.
- The first-run bootstrap command is intended for local bundled-Postgres setup. Review `prisma/seeds/auth-users.js` before using it outside local development because it creates default admin accounts.
- The storage prep step creates missing host folders, reuses an existing PostgreSQL data directory if present, and refuses to proceed if the target directory is non-empty but does not look like a real PostgreSQL cluster.
- The Docker image installs Chromium because the app uses Playwright for server-side document generation.
- The image uses non-sensitive local placeholder values at build time for server-only env validation. Real runtime values are still required when the container starts.
- `NEXT_PUBLIC_APP_URL` is a public build-time value. If your public domain changes, rebuild the image.

## VPS Checklist

- Install Node.js 20 and npm.
- Install PostgreSQL on the VPS, or point the app to an external PostgreSQL service.
- Clone the repository onto the server.
- Create a production `.env` or equivalent secret store with the required environment variables.
- Install dependencies:

```bash
npm ci
```

- Generate Prisma client:

```bash
npm run db:generate
```

- Build the app:

```bash
npm run build
```

- Back up the database.
- Run migrations deliberately:

```bash
npm run db:deploy
```

- Start the app behind a reverse proxy such as Nginx or Caddy:

```bash
PORT=5000 npm run start
```

- Route public traffic from `443` to the app port and verify `GET /api/health`.

## PaaS Checklist

- Use a platform that supports a standard Node.js build/start flow.
- Configure the build command as:

```bash
npm install && npm run build
```

- Configure the start command as:

```bash
npm run start
```

- Provide the required production environment variables in the platform secret/config UI.
- Attach PostgreSQL and set `DATABASE_URL` to that service.
- If the platform separates build-time and runtime variables, make sure `NEXT_PUBLIC_APP_URL` is available during build.
- If the platform supports health checks, point them to `/api/health`.
- If the platform needs a custom Playwright browser path, set `PLAYWRIGHT_BROWSERS_PATH` there instead of changing source code.

## Rollback Checklist

- Keep database backups before each deploy.
- Keep a versioned image tag or git SHA for each release.
- Roll back the app version first if the issue is application-only.
- Restore the database only when the problem is data or migration related and you have confirmed the restore plan.

## Host Recovery Checklist

Use this when reinstalling the machine, moving to a new Linux host, or rebuilding Docker after a disk or OS issue.

1. Preserve the host data root before touching the machine:

```bash
sudo rsync -a /home/ron/business-management-system-data/ /path/to/external-backup/business-management-system-data/
```

2. Preserve the local Docker env files from each repo because they are not committed:

```bash
cp /home/ron/Websites/business-management-development/.env.docker /path/to/external-backup/development.env.docker
cp '/home/ron/Website Production/business-management-production/.env.docker' /path/to/external-backup/production.env.docker
```

3. Reinstall Docker on the replacement host and make sure the Docker service starts on boot:

```bash
sudo systemctl enable --now docker
```

4. Restore the host data folders exactly as separate environments:

```bash
/home/ron/business-management-system-data/development
/home/ron/business-management-system-data/production
```

5. Clone the repos back into their normal locations, then restore the saved `.env.docker` files into each repo.

6. Start development from the development repo when needed:

```bash
cd /home/ron/Websites/business-management-development
docker compose --env-file .env.docker up -d
```

7. Start production from the production repo:

```bash
cd '/home/ron/Website Production/business-management-production'
docker compose --env-file .env.docker up -d
```

8. Verify the final live services:

```bash
curl http://localhost:3000/api/health
curl http://localhost:5000/api/health
```

9. If the app starts but data is missing, do not copy raw PostgreSQL files from another running server. Restore from a logical dump with:

```bash
npm run docker:restore:docker-db -- <dump-file.dump> --confirm
```

10. Keep the host PostgreSQL service disabled on the production machine if Docker owns port `5432`:

```bash
sudo systemctl disable --now postgresql postgresql@16-main
```

## Validation Targets

- App responds on the configured port.
- `GET /api/health` returns healthy.
- Login/auth flows have the correct public URL.
- PDF and document-generation flows work, which confirms Playwright Chromium is available.
