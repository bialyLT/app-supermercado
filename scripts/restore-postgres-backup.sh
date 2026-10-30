#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${ALLOW_RESTORE:?Set ALLOW_RESTORE=YES to confirm the target may be overwritten}"
restore_bin="${PG_RESTORE_BIN:-pg_restore}"

if [[ "$ALLOW_RESTORE" != "YES" ]]; then
  echo "Refusing restore: ALLOW_RESTORE must equal YES" >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file does not exist: $BACKUP_FILE" >&2
  exit 2
fi

"$restore_bin" --dbname="$RESTORE_DATABASE_URL" \
  --clean --if-exists --no-owner --no-privileges \
  --exit-on-error "$BACKUP_FILE"

printf 'restore-completed target=%s backup=%s\n' "$RESTORE_DATABASE_URL" "$BACKUP_FILE"
