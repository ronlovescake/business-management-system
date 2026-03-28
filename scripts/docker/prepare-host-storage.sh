#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

read_env_value() {
  node scripts/docker/read-env-value.js "$ENV_FILE" "$1"
}

BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
postgres_dir="${data_root}/postgres"
backup_dir="${data_root}/backup"

mkdir -p "$postgres_dir" "$backup_dir"

if [[ -d "$postgres_dir" ]]; then
  if [[ -f "$postgres_dir/PG_VERSION" ]]; then
    echo "Using existing PostgreSQL data directory: $postgres_dir"
  elif [[ ! -r "$postgres_dir" || ! -x "$postgres_dir" ]]; then
    echo "Using existing PostgreSQL data directory: $postgres_dir"
    echo "Host inspection is limited by directory permissions, which is expected for a live Postgres data directory."
  elif [[ -n "$(find "$postgres_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    echo "Refusing to continue: $postgres_dir exists and is not empty, but it does not look like a PostgreSQL data directory."
    echo "Check the path before starting Docker so you do not initialize a new database in the wrong folder."
    exit 1
  else
    echo "Prepared empty PostgreSQL data directory: $postgres_dir"
  fi
fi

echo "Prepared backup directory: $backup_dir"