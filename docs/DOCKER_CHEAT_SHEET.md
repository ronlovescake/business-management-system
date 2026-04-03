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

**Full rebuild and restart** (database up → build image → start app):

```bash
npm run docker:prod
```

---

## Production Deployment

**Standard deploy after pulling code:**

```bash
git pull origin main
npm run docker:build && npm run docker:up
```

**Safe deploy when the pull may include database migrations:**

```bash
npm run docker:db:up
npm run docker:build
docker compose --env-file .env.docker run --rm app npm run db:deploy
npm run docker:up
```

> Run each line in order. This ensures the database is up before migrations run, and migrations run before the new app container starts.

---

## Checking Status

| What you want              | Command                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Container status           | `docker compose --env-file .env.docker ps`                  |
| Recent app logs (last 100) | `docker compose --env-file .env.docker logs --tail 100 app` |
| Health check               | `curl http://localhost:5000/api/health`                     |

---

## Command Quick Reference

| Command                                           | What it does                                                    | When to use it                                              |
| ------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run docker:db:up`                            | Starts only the PostgreSQL container                            | Before running migrations or other steps that need the DB   |
| `npm run docker:build`                            | Builds a fresh app image                                        | After pulling code changes                                  |
| `npm run docker:up`                               | Recreates / restarts the app container using the existing image | When the image is already built and you just need a restart |
| `npm run docker:prod`                             | Full pipeline: DB up → build → app up                           | When you want to rebuild everything in one shot             |
| `docker compose … run --rm app npm run db:deploy` | Runs Prisma migrations inside a temporary container             | After a pull that includes new migration files              |
