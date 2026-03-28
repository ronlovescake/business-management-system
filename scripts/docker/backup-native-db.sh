#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${data_root}/backup"
source_db="${1:-business_management_db}"
timestamp="$(date +%Y%m%d-%H%M%S)"
dump_file="${backup_dir}/${source_db}-${timestamp}.dump"

mkdir -p "$backup_dir"

echo "Creating logical backup from native PostgreSQL database '$source_db'..."
pg_dump -w -Fc "$source_db" -f "$dump_file"
echo "Backup created: $dump_file"