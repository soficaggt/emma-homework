#!/bin/bash
# Runs the security tests against a real Supabase project, inside a transaction that is always rolled back.
# Nothing is left behind (no fake users, no fake tasks). Needs:
#   SUPABASE_PROJECT_REF    the project's reference id (Project Settings > General)
#   SUPABASE_ACCESS_TOKEN   a personal access token (never commit it); not needed where the environment already injects it
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF}"
AUTH=()
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# The test file is too big to pass on the command line, so the request body goes through a file.
node -e 'require("fs").writeFileSync(process.argv[2], JSON.stringify({query: require("fs").readFileSync(process.argv[1], "utf8")}))' \
  "$HERE/rls.test.sql" "$TMP/body.json"
curl -sS -m 300 -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Content-Type: application/json" "${AUTH[@]}" --data-binary @"$TMP/body.json" -o "$TMP/out.json"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log((j.message||JSON.stringify(j)).replace(/\\n/g,"\n"))' "$TMP/out.json" | tee "$TMP/out.txt"
grep -q "EMMA_RLS_TESTS result=PASS" "$TMP/out.txt"
