#!/bin/bash
# Deploys the server functions in supabase/functions/ to the project, through the Supabase Management API.
# Needs SUPABASE_PROJECT_REF, and SUPABASE_ACCESS_TOKEN where the environment does not inject it.
# account-public must accept callers who are not signed in, so its gateway login check is off;
# the function checks everything itself. account-admin needs a signed-in caller.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF}"
AUTH=(); [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
for fn in account-public account-admin; do
  VJ=false; [ "$fn" = account-admin ] && VJ=true
  FILES=(-F "file=@supabase/functions/$fn/index.ts;filename=supabase/functions/$fn/index.ts")
  for f in supabase/functions/_shared/*.ts; do FILES+=(-F "file=@$f;filename=$f"); done
  echo "deploying $fn"
  curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/deploy?slug=$fn" "${AUTH[@]}" \
    -F "metadata={\"entrypoint_path\":\"supabase/functions/$fn/index.ts\",\"name\":\"$fn\",\"verify_jwt\":$VJ};type=application/json" \
    "${FILES[@]}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(" ", j.slug, "version", j.version, j.status)})'
done
