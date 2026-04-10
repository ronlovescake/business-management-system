#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(read_env_value POSTGRES_PASSWORD)}"
POSTGRES_PORT="${POSTGRES_PORT:-$(read_env_value POSTGRES_PORT)}"

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${BACKUP_DIR:-${data_root}/backup}"
target_db="${POSTGRES_DB:-business_management}"
target_user="${POSTGRES_USER:-postgres}"
target_password="${POSTGRES_PASSWORD:-}"
target_port="${POSTGRES_PORT:-5432}"
drill_db="${RESTORE_DRILL_DB_NAME:-${target_db}_restore_drill}"

dump_arg="${1:-}"

if [[ -z "$dump_arg" ]]; then
  echo "Usage: npm run docker:restore:drill -- <dump-file-or-basename>"
  exit 1
fi

if [[ "$drill_db" == "$target_db" ]]; then
  echo "RESTORE_DRILL_DB_NAME must not match POSTGRES_DB."
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

cleanup_drill_db() {
  docker compose --env-file "$ENV_FILE" exec -T db psql -U "$target_user" -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${drill_db}'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${drill_db}";
SQL
}

cleanup_copied_dump() {
  if [[ -n "$copied_dump" && -f "$copied_dump" ]]; then
    rm -f "$copied_dump"
    echo "Cleaned up temporary dump copy: ${copied_dump}"
  fi
}

cleanup_all() {
  cleanup_drill_db
  cleanup_copied_dump
}

trap cleanup_all EXIT

echo "Preparing Docker restore drill from: ${dump_file}"
docker compose --env-file "$ENV_FILE" up -d db

echo "Waiting for Docker Postgres to accept connections..."
for _ in $(seq 1 60); do
  if docker compose --env-file "$ENV_FILE" exec -T db \
    pg_isready -U "$target_user" -d postgres >/dev/null 2>&1; then
    break
  fi
done

if ! docker compose --env-file "$ENV_FILE" exec -T db \
  pg_isready -U "$target_user" -d postgres >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready in time."
  exit 1
fi

cleanup_drill_db

docker compose --env-file "$ENV_FILE" exec -T db psql -U "$target_user" -d postgres -v ON_ERROR_STOP=1 <<SQL
CREATE DATABASE "${drill_db}";
SQL

docker compose --env-file "$ENV_FILE" exec -T db pg_restore \
  -U "$target_user" \
  -d "$drill_db" \
  --no-owner \
  --no-privileges \
  "$container_dump_path"

verify_database_url="$(node -e 'const [user, password, port, database] = process.argv.slice(1); const url = new URL("postgresql://127.0.0.1"); url.username = user; if (password) url.password = password; url.port = port || "5432"; url.pathname = `/${database}`; url.searchParams.set("schema", "public"); console.log(url.toString());' "$target_user" "$target_password" "$target_port" "$drill_db")"

echo "Running post-restore verification against drill database '${drill_db}'..."
npx --no-install tsx scripts/verify-restore.ts --dump "$dump_file" --database-url "$verify_database_url"

echo "Restore drill completed successfully for '${dump_basename}'."