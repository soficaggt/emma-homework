#!/bin/bash
# Builds a throwaway local Postgres from the real migrations, then replays the checklist's database
# requests as a student (rls-app-check.sql). Needs PostgreSQL 16 or 17. Touches no real project.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DATA="$(mktemp -d)"; chmod 777 "$DATA"; PORT=54330   # a different port from supabase/tests/run-local.sh
run_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
cleanup() { run_pg "$PGBIN/pg_ctl -D $DATA/db stop -m immediate >/dev/null 2>&1 || true"; rm -rf "$DATA"; }
trap cleanup EXIT
run_pg "$PGBIN/initdb -D $DATA/db -U postgres -A trust >/dev/null"
run_pg "$PGBIN/pg_ctl -D $DATA/db -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
PSQL="psql -h /tmp -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1"
$PSQL -d postgres -c "create database emma" >/dev/null
$PSQL -d emma -f "$ROOT/supabase/tests/local_shim.sql"
for f in "${MIGRATIONS_DIR:-$ROOT/supabase/migrations}"/*.sql; do $PSQL -d emma -f "$f" >/dev/null; done
set +e
OUT="$($PSQL -d emma -f "$HERE/rls-app-check.sql" 2>&1)"
set -e
echo "$OUT" | sed -e 's/^psql:[^ ]* ERROR:  //'
echo "$OUT" | grep -q "APP_RLS_CHECK result=PASS" && exit 0 || exit 1
