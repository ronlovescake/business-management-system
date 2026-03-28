#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

data_root="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}"
postgres_dir="${data_root}/postgres"
backup_dir="${data_root}/backup"

mkdir -p "$postgres_dir" "$backup_dir"

if [[ -d "$postgres_dir" ]]; then
  if [[ -f "$postgres_dir/PG_VERSION" ]]; then
    echo "Using existing PostgreSQL data directory: $postgres_dir"
  elif [[ -n "$(find "$postgres_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    echo "Refusing to continue: $postgres_dir exists and is not empty, but it does not look like a PostgreSQL data directory."
    echo "Check the path before starting Docker so you do not initialize a new database in the wrong folder."
    exit 1
  else
    echo "Prepared empty PostgreSQL data directory: $postgres_dir"
  fi
fi

echo "Prepared backup directory: $backup_dir"