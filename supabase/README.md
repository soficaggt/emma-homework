# Supabase (database and security)

- `migrations/` the database, built in order. Applied to the emma-homework project in step 2. Add a new numbered file for every change; never edit one that has been applied.
- `tests/rls.test.sql` the security tests (they try to break the rules). Always rolled back, so safe to run on the real project.
- `tests/run-local.sh` builds a throwaway local Postgres that imitates Supabase, applies the migrations and runs the tests. Needs PostgreSQL 16 or 17 installed. No account needed.
- `tests/run-remote.sh` runs the same tests against the real project. Needs `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` in the environment (never commit them).
- `functions/` server functions (step 3 onward).

Look for `EMMA_RLS_TESTS result=PASS` at the end of a run.

How the rules are built, in one paragraph: every table has Row Level Security on and no access by default. `migrations/..0800_grants_and_seed.sql` is the single list of which tables the app may touch at all. Row policies decide which rows. A "column guard" trigger decides which columns a student, a parent or a coach may set, so a student can add a task but cannot set its coins, and a parent can record consent but nothing else. Server code (Edge Functions with the service key, and the SECURITY DEFINER functions) is not limited by the guard, which is what lets it write coins, done-state and verified status.
