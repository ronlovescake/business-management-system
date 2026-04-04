#!/bin/sh
set -eu

if [ "${PITR_ENABLED:-false}" = "true" ]; then
  pgdata_dir="${PGDATA:-/var/lib/postgresql/data}"
  pg_hba_file="${pgdata_dir}/pg_hba.conf"
  legacy_replication_rule="host replication all all scram-sha-256"
  replication_rule="host replication all samenet scram-sha-256"

  docker-entrypoint.sh postgres \
    -c wal_level=replica \
    -c archive_mode=on \
    -c "archive_command=/bin/sh /usr/local/bin/archive-wal.sh %p %f" \
    -c "archive_timeout=${PITR_ARCHIVE_TIMEOUT_SECONDS:-300}s" \
    -c max_wal_senders=5 &

  postgres_pid="$!"

  trap 'kill -TERM "$postgres_pid" 2>/dev/null || true; wait "$postgres_pid"' INT TERM

  for _ in $(seq 1 30); do
    if pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if [ -f "$pg_hba_file" ]; then
    sed -i "s/^${legacy_replication_rule}$//" "$pg_hba_file"
  fi

  if [ -f "$pg_hba_file" ] && ! grep -Fqx "$replication_rule" "$pg_hba_file"; then
    printf '\n%s\n' "$replication_rule" >>"$pg_hba_file"
  fi

  for _ in $(seq 1 30); do
    if pg_ctl -D "$pgdata_dir" reload >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  wait "$postgres_pid"
  exit "$?"
fi

exec docker-entrypoint.sh postgres