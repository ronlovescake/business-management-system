# Docker Cheat Sheet

Quick reference for running the Business Management System with Docker.

---

## Getting Started (First Time Only)

If this is your first time setting up the project with Docker, run these two commands in order:

```bash
npm run docker:prepare-storage
docker compose --env-file .env.docker run --rm app npm run docker:bootstrap
```

This creates the required storage directories and initializes the database.

---

## Development

**Run the app locally against a Dockerized database** — useful when you want hot-reload on the Next.js side but don't want to install PostgreSQL on your machine:

```bash
docker compose --env-file .env.docker up -d db
npm run dev:docker
```

**Rebuild everything after pulling new code:**

```bash
npm run docker:build && npm run docker:up
```

**Restart the app container without rebuilding** (image already exists):

```bash
npm run docker:up
```

**Full rebuild and restart** (prepare storage → database up → build image → migrate → start app):

```bash
npm run docker:prod
```

This command now runs Prisma deploy automatically before the app container starts.

---

## Production Deployment

Make all changes in the development checkout, validate them, and push or merge the intended release to `origin/main` first. Do not edit source files in the production checkout.

**Update the production checkout after the release is on the remote:**

```bash
cd "/home/ron/Websites Production/business-management-production"
git pull --ff-only origin main
```

Pulling updates tracked files only; it does not deploy or restart production. Before deployment, verify a current backup and review any migration against the production database and migration history. Follow the approved production deployment procedure; do not run the development `docker:prod` pipeline as an automatic next step.

Keep the production environment file, Docker project, and data root separate from development. See [DEPLOYMENT.md](./DEPLOYMENT.md) for production safety and recovery guidance.

---

## Checking Status

| What you want              | Command                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Container status           | `docker compose --env-file .env.docker ps`                  |
| Recent app logs (last 100) | `docker compose --env-file .env.docker logs --tail 100 app` |
| Health check               | `curl http://localhost:5000/api/health`                     |

---

## Command Quick Reference

| Command                    | What it does                                                            | When to use it                                                                 |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run docker:db:up`     | Starts only the PostgreSQL container                                    | Before running migrations or other steps that need the DB                      |
| `npm run docker:db:deploy` | Waits for PostgreSQL, then runs Prisma migrations in Docker             | Before app startup when the pulled code may include schema changes             |
| `npm run docker:build`     | Builds a fresh app image                                                | After pulling code changes                                                     |
| `npm run docker:up`        | Recreates / restarts the app container using the existing image         | When the image is already built and you just need a restart                    |
| `npm run docker:prod`      | Full local pipeline: prepare storage → DB up → build → migrate → app up | Development or a verified safe environment, not an automatic production deploy |
