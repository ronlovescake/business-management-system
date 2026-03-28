#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
backup_dir="${data_root}/backup"
source_db="${1:-business_management_db}"
timestamp="$(date +%Y%m%d-%H%M%S)"
dump_file="${backup_dir}/${source_db}-${timestamp}.dump"

mkdir -p "$backup_dir"

echo "Creating logical backup from native PostgreSQL database '$source_db'..."
pg_dump -w -Fc "$source_db" -f "$dump_file"
echo "Backup created: $dump_file"