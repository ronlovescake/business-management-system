#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-$ENV_FILE}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

docker_compose() {
  if [[ -n "$COMPOSE_FILE_PATH" ]]; then
    docker compose -f "$COMPOSE_FILE_PATH" --env-file "$COMPOSE_ENV_FILE" "$@"
    return
  fi

  docker compose --env-file "$COMPOSE_ENV_FILE" "$@"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(read_env_value COMPOSE_PROJECT_NAME)}"

resolve_service_container() {
  local service_name="$1"

  if [[ -z "$COMPOSE_PROJECT_NAME" ]]; then
    return 0
  fi

  docker ps -aq \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME}" \
    --filter "label=com.docker.compose.service=${service_name}" \
    | head -n 1
}

db_container_id="${DB_CONTAINER_ID:-$(resolve_service_container db)}"
app_container_id="${APP_CONTAINER_ID:-$(resolve_service_container app)}"

start_db_service() {
  if [[ -n "$db_container_id" ]]; then
    docker start "$db_container_id" >/dev/null 2>&1 || true
    return
  fi

  docker_compose up -d db
  db_container_id="$(resolve_service_container db)"
}

stop_app_service() {
  if [[ -n "$app_container_id" ]]; then
    docker stop "$app_container_id" >/dev/null 2>&1 || true
    return
  fi

  docker_compose stop app || true
}

start_app_service() {
  if [[ -n "$app_container_id" ]]; then
    docker start "$app_container_id" >/dev/null 2>&1 || true
    return
  fi

  docker_compose up -d app
}

docker_db_exec() {
  if [[ -n "$db_container_id" ]]; then
    docker exec -i "$db_container_id" "$@"
    return
  fi

  docker_compose exec -T db "$@"
}

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${BACKUP_DIR:-${data_root}/backup}"
target_db="${POSTGRES_DB:-business_management}"
target_user="${POSTGRES_USER:-postgres}"
skip_app_start="${SKIP_APP_START:-false}"

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
elif [[ -f "${backup_dir}/${dump_arg}" ]]; then
  dump_file="${backup_dir}/${dump_arg}"
else
  mapfile -t dump_matches < <(find "$backup_dir" -type f -name "$dump_arg" 2>/dev/null)
  if [[ ${#dump_matches[@]} -eq 1 ]]; then
    dump_file="${dump_matches[0]}"
  elif [[ ${#dump_matches[@]} -gt 1 ]]; then
    echo "Multiple dump files matched '$dump_arg'. Please pass a more specific path inside ${backup_dir}."
    printf ' - %s\n' "${dump_matches[@]}"
    exit 1
  else
    dump_file="${backup_dir}/${dump_arg}"
  fi
fi

if [[ ! -f "$dump_file" ]]; then
  echo "Dump file not found: $dump_file"
  exit 1
fi

dump_basename="$(basename "$dump_file")"
container_dump_path="/backups/${dump_basename}"

echo "Validating full dump manifest and checksum..."
node scripts/docker/validate-dump-backup.js "$dump_file"

copied_dump=""
if [[ "$dump_file" != "${backup_dir}/${dump_basename}" ]]; then
  mkdir -p "$backup_dir"
  cp "$dump_file" "${backup_dir}/${dump_basename}"
  copied_dump="${backup_dir}/${dump_basename}"
else
  dump_relative_path="${dump_file#${backup_dir}/}"
  container_dump_path="/backups/${dump_relative_path}"
fi

cleanup_copied_dump() {
  if [[ -n "$copied_dump" && -f "$copied_dump" ]]; then
    rm -f "$copied_dump"
    echo "Cleaned up temporary dump copy: ${copied_dump}"
  fi
}
trap cleanup_copied_dump EXIT

echo "Preparing Docker database restore from: ${dump_file}"
start_db_service
stop_app_service

echo "Waiting for Docker Postgres to accept connections..."
for _ in $(seq 1 60); do
  if docker_db_exec \
    pg_isready -U "$target_user" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker_db_exec \
  pg_isready -U "$target_user" -d postgres >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready in time."
  exit 1
fi

docker_db_exec psql -U "$target_user" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${target_db}'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${target_db}";
CREATE DATABASE "${target_db}";
SQL

docker_db_exec pg_restore \
  -U "$target_user" \
  -d "$target_db" \
  --no-owner \
  --no-privileges \
  "$container_dump_path"

if [[ "$skip_app_start" == "true" || "$skip_app_start" == "1" ]]; then
  echo "Restore completed into Docker database '${target_db}'. App remains stopped."
else
  start_app_service
  echo "Restore completed into Docker database '${target_db}'."
fi