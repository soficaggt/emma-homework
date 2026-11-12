#!/bin/bash
# Runs the migrations and the security tests on a throwaway local Postgres (no Supabase account needed).
# Needs PostgreSQL 16 or 17 installed. Works as root (it runs the database as the "postgres" user).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DATA="$(mktemp -d)"; chmod 777 "$DATA"; PORT=54329
run_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
cleanup() { run_pg "$PGBIN/pg_ctl -D $DATA/db stop -m immediate >/dev/null 2>&1 || true"; rm -rf "$DATA"; }
trap cleanup EXIT
run_pg "$PGBIN/initdb -D $DATA/db -U postgres -A trust >/dev/null"
run_pg "$PGBIN/pg_ctl -D $DATA/db -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
PSQL="psql -h /tmp -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1"
$PSQL -d postgres -c "create database emma" >/dev/null
$PSQL -d emma -f "$HERE/local_shim.sql"
MIGDIR="${MIGRATIONS_DIR:-$ROOT/supabase/migrations}"
for f in "$MIGDIR"/*.sql; do echo "applying $(basename "$f")"; $PSQL -d emma -f "$f" >/dev/null; done
echo "running security tests"
set +e
OUT="$($PSQL -d emma -f "$HERE/rls.test.sql" 2>&1)"
set -e
echo "$OUT"
echo "$OUT" | grep -q "EMMA_RLS_TESTS result=PASS" && exit 0 || exit 1
