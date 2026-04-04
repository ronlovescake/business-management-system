#!/usr/bin/env bash
set -euo pipefail

# restore-pitr-into-scratch.sh
#
# Restores a PITR base backup + WAL replay into a temporary standalone PostgreSQL
# container. Does NOT stop or modify the live database, app, or Docker Compose stack.
#
# Usage:
#   npm run docker:restore:pitr:scratch -- --base-backup <folder> --target-time <ISO-8601>
#
# Optional environment variables:
#   PITR_SCRATCH_PORT   Host port to expose the scratch DB on (default: 5433)
#   ENV_FILE            Path to env file (default: .env.docker)
#
# After the script finishes:
#   - A container named 'bms-pitr-scratch' is running with the recovered state
#   - Connect:  docker exec -it bms-pitr-scratch psql -U <POSTGRES_USER> -d <POSTGRES_DB>
#   - Or via:   psql -h 127.0.0.1 -p <PITR_SCRATCH_PORT> -U <POSTGRES_USER> <POSTGRES_DB>
#   - Cleanup:  docker rm -f bms-pitr-scratch  &&  rm -rf <scratch_dir printed below>

ENV_FILE="${ENV_FILE:-.env.docker}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(read_env_value POSTGRES_PASSWORD)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}"

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${BACKUP_DIR:-${data_root}/backup}"
wal_archive_dir="${backup_dir}/pitr/wal"
base_backup_root="${backup_dir}/pitr/base"

scratch_container="bms-pitr-scratch"
scratch_port="${PITR_SCRATCH_PORT:-5433}"
scratch_dir="${data_root}/pitr-scratch-$(date +%Y%m%d-%H%M%S)"

base_backup_arg=""
target_time_arg=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-backup)
      base_backup_arg="${2:-}"
      shift 2
      ;;
    --target-time)
      target_time_arg="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: npm run docker:restore:pitr:scratch -- --base-backup <folder> --target-time <ISO-8601>"
      exit 1
      ;;
  esac
done

if [[ -z "$base_backup_arg" || -z "$target_time_arg" ]]; then
  echo "Usage: npm run docker:restore:pitr:scratch -- --base-backup <folder> --target-time <ISO-8601>"
  exit 1
fi

if [[ "$base_backup_arg" = /* ]]; then
  base_backup_dir="$base_backup_arg"
else
  base_backup_dir="${base_backup_root}/${base_backup_arg}"
fi

if [[ ! -d "$base_backup_dir" ]]; then
  echo "Base backup directory not found: $base_backup_dir"
  exit 1
fi

if [[ ! -f "${base_backup_dir}/MANIFEST.json" ]]; then
  echo "Base backup manifest not found: ${base_backup_dir}/MANIFEST.json"
  exit 1
fi

if [[ ! -d "$wal_archive_dir" ]]; then
  echo "WAL archive directory not found: $wal_archive_dir"
  exit 1
fi

target_time_normalized="$(node -e "const value = process.argv[1]; const date = new Date(value); if (Number.isNaN(date.getTime())) { process.exit(1); } process.stdout.write(date.toISOString());" "$target_time_arg")" || {
  echo "Invalid --target-time value. Use an ISO-8601 timestamp."
  exit 1
}

# Stop any leftover scratch container from a previous run
if docker inspect "$scratch_container" >/dev/null 2>&1; then
  echo "Removing previous scratch container: ${scratch_container}"
  docker rm -f "$scratch_container" >/dev/null
fi

echo "Preparing PITR scratch restore"
echo "  Base backup : ${base_backup_dir}"
echo "  Target time : ${target_time_normalized}"
echo "  Scratch dir : ${scratch_dir}"
echo "  Scratch port: ${scratch_port}"
echo ""

# Copy base backup into the scratch data directory
mkdir -p "$scratch_dir"
cp -a "${base_backup_dir}/." "$scratch_dir/"
# Remove the BMS manifest so PostgreSQL doesn't see a foreign file
rm -f "${scratch_dir}/MANIFEST.json"

# Write recovery configuration
cat >> "${scratch_dir}/postgresql.auto.conf" <<EOF
restore_command = 'cp /wal/%f %p'
recovery_target_time = '${target_time_normalized}'
recovery_target_timeline = 'latest'
recovery_target_action = 'promote'
EOF

touch "${scratch_dir}/recovery.signal"

# Fix ownership so the postgres user inside the container can read the data dir
# (postgres:16 uses UID 999 internally)
echo "Setting data directory ownership for postgres user inside container..."
docker run --rm \
  -v "${scratch_dir}:/pgdata" \
  postgres:16 \
  chown -R 999:999 /pgdata

# Start the scratch container
# - Mounts the scratch data dir as PGDATA
# - Mounts WAL archive read-only at /wal (matches restore_command above)
# - Exposes scratch port on the host for optional local psql access
# - Does NOT use the custom PITR entrypoint — plain postgres startup into recovery mode
docker run -d \
  --name "$scratch_container" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -e PGDATA=/var/lib/postgresql/data \
  -v "${scratch_dir}:/var/lib/postgresql/data" \
  -v "${wal_archive_dir}:/wal:ro" \
  -p "${scratch_port}:5432" \
  postgres:16 >/dev/null

echo "Scratch container started. Waiting for PITR recovery to complete..."
for _ in $(seq 1 120); do
  if docker exec "$scratch_container" pg_isready -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker exec "$scratch_container" pg_isready -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; then
  echo ""
  echo "Scratch container did not become ready within 4 minutes."
  echo "This may mean WAL replay is still in progress or the target time is not reachable."
  echo ""
  echo "Check recovery progress with: docker logs --tail 40 ${scratch_container}"
  echo "If recovery succeeded later, connect with:"
  echo "  docker exec -it ${scratch_container} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
  echo ""
  echo "Clean up with:"
  echo "  docker rm -f ${scratch_container}"
  echo "  rm -rf ${scratch_dir}"
  exit 1
fi

echo ""
echo "================================================================"
echo "  PITR scratch restore completed successfully."
echo "================================================================"
echo ""
echo "  Recovery target: ${target_time_normalized}"
echo "  Scratch dir    : ${scratch_dir}"
echo ""
echo "  Connect to scratch DB:"
echo "    docker exec -it ${scratch_container} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
echo "    psql -h 127.0.0.1 -p ${scratch_port} -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
echo ""
echo "  Extract rows before reinserting into live DB (example):"
echo "    docker exec ${scratch_container} pg_dump -U ${POSTGRES_USER} \\"
echo "      --data-only --column-inserts --table=<table> \\"
echo "      -d ${POSTGRES_DB} > /tmp/recovered_rows.sql"
echo ""
echo "  When finished, clean up with:"
echo "    docker rm -f ${scratch_container}"
echo "    rm -rf ${scratch_dir}"
echo ""
