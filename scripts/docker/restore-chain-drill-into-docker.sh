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
target_backup="${1:-}"

if [[ -z "$target_backup" ]]; then
  echo "Usage: npm run docker:restore:chain-drill -- <backup-folder>"
  exit 1
fi

if [[ "$drill_db" == "$target_db" ]]; then
  echo "RESTORE_DRILL_DB_NAME must not match POSTGRES_DB."
  exit 1
fi

plan_json="$(npx --no-install tsx scripts/plan-restore.ts -- --folder "$target_backup" --json)"

baseline_relative_path="$(node -e 'const plan = JSON.parse(process.argv[1]); if (plan.status === "invalid") { console.error(plan.errors.join("; ")); process.exit(1); } const step = plan.steps.find((entry) => entry.action === "restore-full-dump"); if (!step || !step.artifactPath) { console.error("Restore plan does not contain a full-dump baseline."); process.exit(1); } process.stdout.write(step.artifactPath);' "$plan_json")"

baseline_dump_file="${backup_dir}/${baseline_relative_path}"
if [[ ! -f "$baseline_dump_file" ]]; then
  echo "Baseline dump file not found: $baseline_dump_file"
  exit 1
fi

baseline_dump_basename="$(basename "$baseline_dump_file")"
container_dump_path="/backups/${baseline_relative_path}"

echo "Validating full dump manifest and checksum..."
node scripts/docker/validate-dump-backup.js "$baseline_dump_file"

cleanup_drill_db() {
  docker compose --env-file "$ENV_FILE" exec -T db psql -U "$target_user" -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${drill_db}'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${drill_db}";
SQL
}

trap cleanup_drill_db EXIT

echo "Preparing chain restore drill for target '${target_backup}' using baseline ${baseline_dump_basename}"
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

echo "Replaying differential/log chain into drill database '${drill_db}'..."
npx --no-install tsx scripts/replay-restore-chain.ts --folder "$target_backup" --database-url "$verify_database_url"

echo "Chain restore drill completed successfully for '${target_backup}'."