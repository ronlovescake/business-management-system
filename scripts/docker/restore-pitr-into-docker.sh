#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${BACKUP_DIR:-${data_root}/backup}"
postgres_dir="${data_root}/postgres"
wal_archive_dir="${backup_dir}/pitr/wal"
base_backup_root="${backup_dir}/pitr/base"

base_backup_arg=""
target_time_arg=""
confirm_arg=""

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
    --confirm)
      confirm_arg="--confirm"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: npm run docker:restore:pitr -- --base-backup <folder> --target-time <ISO-8601> --confirm"
      exit 1
      ;;
  esac
done

if [[ -z "$base_backup_arg" || -z "$target_time_arg" ]]; then
  echo "Usage: npm run docker:restore:pitr -- --base-backup <folder> --target-time <ISO-8601> --confirm"
  exit 1
fi

if [[ "$confirm_arg" != "--confirm" ]]; then
  echo "Refusing PITR restore without --confirm because this replaces the current Docker database contents."
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

target_time_normalized="$(node -e "const value = process.argv[1]; const date = new Date(value); if (Number.isNaN(date.getTime())) { process.exit(1); } process.stdout.write(date.toISOString().replace('T', ' ').replace('Z', '+00'));" "$target_time_arg")" || {
  echo "Invalid --target-time value. Use an ISO-8601 timestamp."
  exit 1
}

recovery_snapshot_dir="${postgres_dir}.pre-pitr-$(date +%Y%m%d-%H%M%S)"

echo "Preparing PITR restore from base backup: ${base_backup_dir}"
echo "Target recovery time: ${target_time_normalized}"

docker compose --env-file "$ENV_FILE" stop app || true
docker compose --env-file "$ENV_FILE" stop db || true

if [[ -d "$postgres_dir" ]]; then
  mv "$postgres_dir" "$recovery_snapshot_dir"
fi

mkdir -p "$postgres_dir"
cp -a "${base_backup_dir}/." "$postgres_dir/"
rm -f "${postgres_dir}/MANIFEST.json"

cat >>"${postgres_dir}/postgresql.auto.conf" <<EOF
restore_command = 'cp /backups/pitr/wal/%f %p'
recovery_target_time = '${target_time_normalized}'
recovery_target_timeline = 'latest'
recovery_target_action = 'promote'
EOF

touch "${postgres_dir}/recovery.signal"

docker compose --env-file "$ENV_FILE" up -d db

echo "Waiting for PITR-restored PostgreSQL to accept connections..."
for _ in $(seq 1 90); do
  if docker compose --env-file "$ENV_FILE" exec -T db \
    pg_isready -U "$(read_env_value POSTGRES_USER)" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker compose --env-file "$ENV_FILE" exec -T db \
  pg_isready -U "$(read_env_value POSTGRES_USER)" -d postgres >/dev/null 2>&1; then
  echo "PITR restore database did not become ready in time."
  echo "Previous data directory snapshot preserved at: ${recovery_snapshot_dir}"
  exit 1
fi

docker compose --env-file "$ENV_FILE" up -d app

echo "PITR restore completed."
echo "Recovered database is running from base backup: ${base_backup_dir}"
echo "Recovery target time: ${target_time_normalized}"
echo "Previous data directory snapshot preserved at: ${recovery_snapshot_dir}"