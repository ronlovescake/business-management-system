# Docker Cheat Sheet

Short command reference for the Docker workflows used in this repository.

## Development

### Host app against Docker database

```bash
docker compose --env-file .env.docker up -d db
npm run dev:docker
```

### First-time Docker bootstrap

```bash
npm run docker:prepare-storage
docker compose --env-file .env.docker run --rm app npm run docker:bootstrap
```

### Rebuild after pull

```bash
npm run docker:build && npm run docker:up
```

### Recreate app without rebuild

```bash
npm run docker:up
```

### Full Docker rebuild and restart

```bash
npm run docker:prod
```

### Status, logs, health

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 app
curl http://localhost:5000/api/health
```

## Production

### Pull latest code

```bash
git pull origin main
```

### Normal rebuild and restart after pull

```bash
npm run docker:build && npm run docker:up
```

### Safe deploy when migrations may be included

```bash
npm run docker:db:up && npm run docker:build && docker compose --env-file .env.docker run --rm app npm run db:deploy && npm run docker:up
```

### Recreate app without rebuild

```bash
npm run docker:up
```

### Full Docker rebuild and restart

```bash
npm run docker:prod
```

### Status, logs, health

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 app
curl http://localhost:5000/api/health
```

## When To Use Each Command

### `npm run docker:db:up`

Use when you need the PostgreSQL container running before other Docker steps.

```bash
npm run docker:db:up
```

### `npm run docker:build`

Use after pulling code changes that require a new app image.

```bash
npm run docker:build
```

### `npm run docker:up`

Use when the image is already built and you only want to recreate or restart the app container.

```bash
npm run docker:up
```

### `npm run docker:prod`

Use when you want the full bundled flow: database up, app build, app up.

```bash
npm run docker:prod
```

### `docker compose --env-file .env.docker run --rm app npm run db:deploy`

Use when a pull may include Prisma migrations.

```bash
docker compose --env-file .env.docker run --rm app npm run db:deploy
```