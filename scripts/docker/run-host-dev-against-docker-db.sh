#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"
HOST_DEV_PORT="${HOST_DEV_PORT:-5001}"

if [[ ! -d node_modules ]]; then
  echo "Project dependencies are not installed. Run 'npm install' in the repo root first."
  exit 1
fi

if [[ ! -f node_modules/dotenv/package.json ]]; then
  echo "The 'dotenv' package is missing from node_modules. Run 'npm install' in the repo root first."
  exit 1
fi

read_env_value() {
  node - "$ENV_FILE" "$1" <<'NODE'
const fs = require('fs');
const dotenv = require('dotenv');

const [, , envFile, key] = process.argv;

if (!fs.existsSync(envFile)) {
  process.exit(0);
}

const parsed = dotenv.parse(fs.readFileSync(envFile));
process.stdout.write(parsed[key] ?? '');
NODE
}

load_env_file() {
  eval "$(node - "$ENV_FILE" <<'NODE'
const fs = require('fs');
const dotenv = require('dotenv');

const [, , envFile] = process.argv;

if (!fs.existsSync(envFile)) {
  process.exit(0);
}

const parsed = dotenv.parse(fs.readFileSync(envFile));

for (const [key, value] of Object.entries(parsed)) {
  const escaped = JSON.stringify(String(value));
  process.stdout.write(`export ${key}=${escaped}\n`);
}
NODE
)"
}

load_env_file

DATABASE_URL="${DATABASE_URL:-$(read_env_value DATABASE_URL)}"
POSTGRES_PORT="${POSTGRES_PORT:-$(read_env_value POSTGRES_PORT)}"
BMS_DATA_ROOT="${BMS_DATA_ROOT:-$(read_env_value BMS_DATA_ROOT)}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is missing. Check $ENV_FILE."
  exit 1
fi

if [[ -z "${POSTGRES_PORT:-}" ]]; then
  echo "POSTGRES_PORT is missing. Check $ENV_FILE."
  exit 1
fi

host_database_url="$(POSTGRES_PORT="$POSTGRES_PORT" node - <<'NODE' "$DATABASE_URL"
const databaseUrl = process.argv[2];
const url = new URL(databaseUrl);
url.hostname = '127.0.0.1';
url.port = process.env.POSTGRES_PORT || '5432';
process.stdout.write(url.toString());
NODE
)"

export DATABASE_URL="$host_database_url"
export PORT="$HOST_DEV_PORT"
export NEXT_PUBLIC_APP_URL="http://localhost:${HOST_DEV_PORT}"
export NEXTAUTH_URL="http://localhost:${HOST_DEV_PORT}"
export BACKUP_DIR="${BMS_DATA_ROOT:-${HOME}/business-management-system-data}/backup"

if [[ "${1:-}" == "--print-config" ]]; then
  cat <<EOF
PORT=$PORT
DATABASE_URL=$DATABASE_URL
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
NEXTAUTH_URL=$NEXTAUTH_URL
BACKUP_DIR=$BACKUP_DIR
EOF
  exit 0
fi

exec npx next dev -H 0.0.0.0 -p "$HOST_DEV_PORT"