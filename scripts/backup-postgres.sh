#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_OFFSITE_DIR:?BACKUP_OFFSITE_DIR is required}"

dump_bin="${PG_DUMP_BIN:-pg_dump}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
case "$retention_days" in
  ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
  0) echo "BACKUP_RETENTION_DAYS must be greater than zero" >&2; exit 2 ;;
esac

mkdir -p "$BACKUP_DIR" "$BACKUP_OFFSITE_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="supermercado-${timestamp}.dump"
tmp_file="$BACKUP_DIR/.${backup_name}.tmp"
local_file="$BACKUP_DIR/$backup_name"
offsite_file="$BACKUP_OFFSITE_DIR/$backup_name"
trap 'rm -f "$tmp_file"' EXIT

"$dump_bin" "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$tmp_file"
chmod 600 "$tmp_file"
mv "$tmp_file" "$local_file"
cp --preserve=mode,timestamps "$local_file" "$offsite_file"
chmod 600 "$offsite_file"

find "$BACKUP_DIR" -type f -name 'supermercado-*.dump' -mtime "+$retention_days" -delete
find "$BACKUP_OFFSITE_DIR" -type f -name 'supermercado-*.dump' -mtime "+$retention_days" -delete

printf 'backup-created local=%s offsite=%s retention_days=%s\n' "$local_file" "$offsite_file" "$retention_days"
