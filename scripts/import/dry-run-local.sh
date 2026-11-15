#!/bin/bash
# Dry run on a throwaway local Postgres: builds it, applies supabase/migrations (read only, nothing in
# supabase/ is changed), runs the import against a fake student inside a rolled-back block, prints the
# report, and deletes the database. Needs PostgreSQL 16 or 17 and Node 18+.
#   scripts/import/dry-run-local.sh --snapshot /path/to/snapshot [--screen-coins N]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DATA="$(mktemp -d)"; chmod 777 "$DATA"; PORT=54339
run_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
cleanup() { run_pg "$PGBIN/pg_ctl -D $DATA/db stop -m immediate >/dev/null 2>&1 || true"; rm -rf "$DATA"; }
trap cleanup EXIT
run_pg "$PGBIN/initdb -D $DATA/db -U postgres -A trust >/dev/null"
run_pg "$PGBIN/pg_ctl -D $DATA/db -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
PSQL="psql -h /tmp -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1"
$PSQL -d postgres -c "create database emma" >/dev/null
$PSQL -d emma -f "$ROOT/supabase/tests/local_shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -d emma -f "$f" >/dev/null; done
echo "throwaway database ready ($(ls "$ROOT"/supabase/migrations/*.sql | wc -l) migrations applied)" >&2
IMPORT_PSQL="$PSQL -d emma" node "$HERE/import.mjs" dry-run --target local "$@"
