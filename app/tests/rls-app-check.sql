-- Replays what the Days checklist sends to the database, signed in as a student, against the real
-- migrations on a throwaway local Postgres. "Must work" lines are what the app does. "Must be
-- refused" lines are what a student (or a modified app) must never be able to do.
-- Run with: app/tests/rls-app-check.sh      Look for:  APP_RLS_CHECK result=PASS
\set ON_ERROR_STOP on

create temp table results (n serial, ok boolean, name text, detail text);

-- Run one statement as a signed-in student. Returns '00000' when it worked, else the error code, and rows touched.
create function pg_temp.as_student(p_uid uuid, p_sql text, out st text, out msg text, out cnt bigint) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
  begin
    execute p_sql;
    get diagnostics cnt = row_count;
    st := '00000';
  exception when others then st := sqlstate; msg := sqlerrm; cnt := 0;
  end;
  execute 'reset role';
end $$;

create function pg_temp.expect_ok(p_name text, p_uid uuid, p_sql text, p_rows bigint default null) returns void language plpgsql as $$
declare r record;
begin
  select * into r from pg_temp.as_student(p_uid, p_sql);
  insert into results(ok, name, detail) values (r.st = '00000' and (p_rows is null or r.cnt = p_rows), 'MUST WORK: ' || p_name,
    format('state=%s rows=%s expected=%s %s', r.st, r.cnt, coalesce(p_rows::text, 'any'), coalesce(r.msg, '')));
end $$;

-- Refused means an error, or zero rows touched.
create function pg_temp.expect_no(p_name text, p_uid uuid, p_sql text) returns void language plpgsql as $$
declare r record;
begin
  select * into r from pg_temp.as_student(p_uid, p_sql);
  insert into results(ok, name, detail) values (r.st <> '00000' or r.cnt = 0, 'MUST BE REFUSED: ' || p_name,
    format('state=%s rows=%s %s', r.st, r.cnt, coalesce(r.msg, '')));
end $$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  b uuid := '00000000-0000-4000-8000-0000000000a2';
  ta_coach uuid := '00000000-0000-4000-8000-00000000ea01';
  ta_own   uuid := '00000000-0000-4000-8000-00000000ea02';
  ta_done  uuid := '00000000-0000-4000-8000-00000000ea03';
  ta_plat  uuid := '00000000-0000-4000-8000-00000000ea04';
  tb       uuid := '00000000-0000-4000-8000-00000000eb01';
  cols text := 'id, student_id, date, original_date, title, note, minutes, type, color_step, sort_order, done, done_at, due_date, not_today, coins, deleted, source, first_step, estimated_minutes, verified_by';
  v text; bad int; coins int;
begin
  -- Seed as the database owner (the same way server code would).
  insert into auth.users(id, email) values (a, 'a@x'), (b, 'b@x');
  insert into public.profiles(id, role, first_name, username) values (a, 'student', 'Ann', 'ann_a'), (b, 'student', 'Bea', 'bea_b');
  insert into public.student_settings(student_id) values (a), (b);
  insert into public.themes(student_id, name) values (a, 'Starter'), (b, 'Starter');
  insert into public.tasks(id, student_id, date, title, source, coins, due_date) values
    (ta_coach, a, '2026-11-16', 'Coach task', 'coach', 3, '2026-11-18'),
    (ta_own,   a, '2026-11-16', 'Own task',   'student', 0, null),
    (ta_plat,  a, '2026-11-16', 'Platform task', 'platform', 3, '2026-11-19'),
    (tb,       b, '2026-11-16', 'Bea task', 'coach', 3, null);
  insert into public.tasks(id, student_id, date, title, source, coins, done, done_at) values (ta_done, a, '2026-11-16', 'Finished', 'coach', 3, true, now());
  insert into public.ledger(student_id, kind, amount, status) values (a, 'earn', 3, 'confirmed'), (a, 'earn', 2, 'held');

  -- READS, exactly the app's queries -------------------------------------------------------------
  perform pg_temp.expect_ok('read her own tasks (the app''s column list)', a, format('select %s from public.tasks where student_id = %L and deleted = false and date between %L and %L', cols, a, '2026-11-16', '2026-11-22'), 4);
  perform pg_temp.expect_no('read another student''s tasks', a, format('select %s from public.tasks where student_id = %L', cols, b));
  perform pg_temp.expect_ok('read her time zone', a, format('select time_zone from public.profiles where id = %L', a), 1);
  perform pg_temp.expect_ok('read her active theme', a, format('select name, theming_depth, palette, fonts, shapes, wording, page_names, currency, color_system from public.themes where student_id = %L and active', a), 1);
  perform pg_temp.expect_no('read another student''s theme', a, format('select name from public.themes where student_id = %L', b));
  perform pg_temp.expect_ok('read her coins ledger', a, format('select amount, status from public.ledger where student_id = %L and status in (''held'',''confirmed'')', a), 2);
  perform pg_temp.expect_ok('read her proof settings', a, format('select no_proof_types from public.student_settings where student_id = %L', a), 1);

  -- WRITES the app makes --------------------------------------------------------------------------
  perform pg_temp.expect_ok('add a task (the app''s insert columns only)', a, format('insert into public.tasks(student_id, date, title, minutes, sort_order) values (%L, %L, ''Piano'', 30, 50)', a, '2026-11-16'), 1);
  select t.coins, t.source into coins, v from public.tasks t where t.title = 'Piano';
  insert into results(ok, name, detail) values (coins = 0 and v = 'student', 'her new task has 0 coins and source student', format('coins=%s source=%s', coins, v));
  perform pg_temp.expect_ok('edit title', a, format('update public.tasks set title = ''New title'' where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('edit note', a, format('update public.tasks set note = ''a note'' where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('edit minutes', a, format('update public.tasks set minutes = 45 where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('pick a color step', a, format('update public.tasks set color_step = 3 where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('let it pick (color step back to null)', a, format('update public.tasks set color_step = null where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('write her own first step', a, format('update public.tasks set first_step = ''open the book'' where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('send a task to Not today', a, format('update public.tasks set not_today = true where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('Do today (date and Not today together)', a, format('update public.tasks set not_today = false, date = ''2026-11-15'' where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('move a task to another day', a, format('update public.tasks set date = ''2026-11-17'', not_today = false where id = %L', ta_plat), 1);
  perform pg_temp.expect_ok('renumber the day (sort order)', a, format('update public.tasks set sort_order = 30 where id = %L', ta_coach), 1);
  perform pg_temp.expect_ok('change the due date of her OWN task', a, format('update public.tasks set due_date = ''2026-11-20'' where id = %L', ta_own), 1);
  perform pg_temp.expect_ok('delete her OWN task', a, format('update public.tasks set deleted = true where id = %L', ta_own), 1);

  -- MUST BE REFUSED --------------------------------------------------------------------------------
  perform pg_temp.expect_no('change the due date a coach/platform set', a, format('update public.tasks set due_date = ''2026-12-01'' where id = %L', ta_coach));
  perform pg_temp.expect_no('delete a task a coach set', a, format('update public.tasks set deleted = true where id = %L', ta_coach));
  perform pg_temp.expect_no('delete a platform task', a, format('update public.tasks set deleted = true where id = %L', ta_plat));
  perform pg_temp.expect_no('check a task off directly', a, format('update public.tasks set done = true where id = %L', ta_coach));
  perform pg_temp.expect_no('set her own coins', a, format('update public.tasks set coins = 6 where id = %L', ta_own));
  perform pg_temp.expect_no('mark a task verified by platform', a, format('update public.tasks set verified_by = ''platform'' where id = %L', ta_coach));
  perform pg_temp.expect_no('set reward status', a, format('update public.tasks set reward_status = ''confirmed'' where id = %L', ta_coach));
  perform pg_temp.expect_no('change a task''s type', a, format('update public.tasks set type = ''fixed'' where id = %L', ta_coach));
  perform pg_temp.expect_no('edit a finished task', a, format('update public.tasks set title = ''edited after done'' where id = %L', ta_done));
  perform pg_temp.expect_no('un-finish a finished task', a, format('update public.tasks set done = false where id = %L', ta_done));
  perform pg_temp.expect_no('edit another student''s task', a, format('update public.tasks set title = ''hacked'' where id = %L', tb));
  perform pg_temp.expect_no('add a task with coins already on it', a, format('insert into public.tasks(student_id, date, title, coins) values (%L, %L, ''rich'', 6)', a, '2026-11-16'));
  perform pg_temp.expect_no('add a task already done', a, format('insert into public.tasks(student_id, date, title, done) values (%L, %L, ''x'', true)', a, '2026-11-16'));
  perform pg_temp.expect_no('add a task as if from a coach or platform', a, format('insert into public.tasks(student_id, date, title, source) values (%L, %L, ''x'', ''platform'')', a, '2026-11-16'));
  perform pg_temp.expect_no('add a task for another student', a, format('insert into public.tasks(student_id, date, title) values (%L, %L, ''x'')', b, '2026-11-16'));
  perform pg_temp.expect_no('write to the coins ledger', a, format('insert into public.ledger(student_id, kind, amount, status) values (%L, ''earn'', 99, ''confirmed'')', a));
  perform pg_temp.expect_no('rewrite her theme', a, format('update public.themes set name = ''mine'' where student_id = %L', a));
  perform pg_temp.expect_no('write a Start session', a, format('insert into public.work_sessions(student_id, task_id) values (%L, %L)', a, ta_coach));
  perform pg_temp.expect_no('change her own time zone', a, format('update public.profiles set time_zone = ''Pacific/Kiritimati'' where id = %L', a));

  select count(*) filter (where not ok) into bad from results;
  raise exception E'APP_RLS_CHECK result=%\n%', case when bad = 0 then 'PASS' else 'FAIL' end,
    (select string_agg(case when r.ok then 'PASS ' else 'FAIL ' end || r.name || case when r.ok then '' else '  -> ' || r.detail end, E'\n' order by r.n) from results r);
end $$;
