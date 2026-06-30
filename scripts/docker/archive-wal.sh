#!/bin/sh
set -eu

source_path="$1"
file_name="$2"
archive_root="${PITR_WAL_ARCHIVE_DIR:-/backups/pitr/wal}"

mkdir -p "$archive_root"
chmod 0777 "$archive_root" 2>/dev/null || true

target_path="${archive_root}/${file_name}"
temp_path="${target_path}.tmp"

if [ -f "$target_path" ]; then
  exit 0
fi

cp "$source_path" "$temp_path"
mv "$temp_path" "$target_path"