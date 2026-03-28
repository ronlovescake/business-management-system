#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}"

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${data_root}/backup"
target_db="${POSTGRES_DB:-business_management}"
target_user="${POSTGRES_USER:-postgres}"

dump_arg="${1:-}"
confirm_arg="${2:-}"

if [[ -z "$dump_arg" ]]; then
  echo "Usage: npm run docker:restore:docker-db -- <dump-file-or-basename> --confirm"
  exit 1
fi

if [[ "$confirm_arg" != "--confirm" ]]; then
  echo "Refusing to restore without --confirm because this replaces the current Docker database contents."
  exit 1
fi

if [[ "$dump_arg" = /* ]]; then
  dump_file="$dump_arg"
else
  dump_file="${backup_dir}/${dump_arg}"
fi

if [[ ! -f "$dump_file" ]]; then
  echo "Dump file not found: $dump_file"
  exit 1
fi

dump_basename="$(basename "$dump_file")"

if [[ "$dump_file" != "${backup_dir}/${dump_basename}" ]]; then
  mkdir -p "$backup_dir"
  cp "$dump_file" "${backup_dir}/${dump_basename}"
fi

echo "Preparing Docker database restore from: ${backup_dir}/${dump_basename}"
docker compose --env-file "$ENV_FILE" up -d db
docker compose --env-file "$ENV_FILE" stop app || true

echo "Waiting for Docker Postgres to accept connections..."
for _ in $(seq 1 60); do
  if docker compose --env-file "$ENV_FILE" exec -T db \
    pg_isready -U "$target_user" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker compose --env-file "$ENV_FILE" exec -T db \
  pg_isready -U "$target_user" -d postgres >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready in time."
  exit 1
fi

docker compose --env-file "$ENV_FILE" exec -T db psql -U "$target_user" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${target_db}'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${target_db}";
CREATE DATABASE "${target_db}";
SQL

docker compose --env-file "$ENV_FILE" exec -T db pg_restore \
  -U "$target_user" \
  -d "$target_db" \
  --no-owner \
  --no-privileges \
  "/backups/${dump_basename}"

docker compose --env-file "$ENV_FILE" up -d app
echo "Restore completed into Docker database '${target_db}'."