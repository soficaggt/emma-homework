-- Security tests for step 2. They try to break the rules, and each "must be refused" test
-- also has "must work" tests next to it, so a rule cannot pass just because everything is broken.
--
-- Everything runs inside one block that is ALWAYS rolled back at the end (it finishes by raising
-- an error that carries the report). So running it against a real project leaves nothing behind.
-- Look for the line:  EMMA_RLS_TESTS result=PASS
--
-- Cast: two coaches (C1 coaches students A and B, C2 coaches student C), three students, two parents
-- (PA belongs to A, PB belongs to B).

create temp table t_results (n serial, ok boolean, name text, detail text);

-- Replace short names with the fixed test IDs.
create function pg_temp.sub(s text) returns text language plpgsql as $$
declare m text[][] := array[
  ['{C1}','00000000-0000-4000-8000-0000000000c1'], ['{C2}','00000000-0000-4000-8000-0000000000c2'],
  ['{SA}','00000000-0000-4000-8000-0000000000a1'], ['{SB}','00000000-0000-4000-8000-0000000000a2'],
  ['{SC}','00000000-0000-4000-8000-0000000000a3'],
  ['{PA}','00000000-0000-4000-8000-0000000000b1'], ['{PB}','00000000-0000-4000-8000-0000000000b2'],
  ['{TA1}','00000000-0000-4000-8000-00000000ea01'], ['{TA2}','00000000-0000-4000-8000-00000000ea02'],
  ['{TA3}','00000000-0000-4000-8000-00000000ea03'], ['{TB1}','00000000-0000-4000-8000-00000000eb01'],
  ['{TC1}','00000000-0000-4000-8000-00000000ec01'],
  ['{THA}','00000000-0000-4000-8000-00000000f0a1'], ['{THB}','00000000-0000-4000-8000-00000000f0b1'],
  ['{PKA}','00000000-0000-4000-8000-00000000f1a1'], ['{PKB}','00000000-0000-4000-8000-00000000f1b1'],
  ['{CIA1}','00000000-0000-4000-8000-00000000f2a1'], ['{CIA2}','00000000-0000-4000-8000-00000000f2a2'],
  ['{CIB1}','00000000-0000-4000-8000-00000000f2b1'],
  ['{PRJA}','00000000-0000-4000-8000-00000000f3a1'], ['{PRJB}','00000000-0000-4000-8000-00000000f3b1'],
  ['{PCA}','00000000-0000-4000-8000-00000000f4a1'], ['{PCB}','00000000-0000-4000-8000-00000000f4b1'],
  ['{NA}','00000000-0000-4000-8000-00000000f5a1'], ['{NC1}','00000000-0000-4000-8000-00000000f5c1']];
  i int;
begin
  for i in 1..array_length(m, 1) loop s := replace(s, m[i][1], m[i][2]); end loop;
  return s;
end $$;

-- Run a statement as a given database role and person. Returns the SQLSTATE ('00000' = worked) and rows touched.
create function pg_temp.t_exec(p_role text, p_uid uuid, p_sql text, out st text, out msg text, out cnt bigint)
language plpgsql as $$
declare q text := pg_temp.sub(p_sql);
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', p_role, 'aal', coalesce(nullif(current_setting('emma.test_aal', true), ''), 'aal2'))::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute q;
    get diagnostics cnt = row_count;
    st := '00000';
  exception when others then
    st := sqlstate; msg := sqlerrm; cnt := 0;
  end;
  execute 'reset role';
end $$;

-- Same, but returns the first value as text ('ERR:<sqlstate>' when refused).
create function pg_temp.t_val(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $$
declare v text; q text := pg_temp.sub(p_sql);
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', p_role, 'aal', coalesce(nullif(current_setting('emma.test_aal', true), ''), 'aal2'))::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute q into v;
  exception when others then
    v := 'ERR:' || sqlstate;
  end;
  execute 'reset role';
  return v;
end $$;

create function pg_temp.t_ok(p_name text, p_cond boolean, p_detail text default null) returns void language plpgsql as $$
begin insert into t_results (ok, name, detail) values (coalesce(p_cond, false), p_name, p_detail); end $$;

-- Must be refused: a permission error, a row-level-security error, or no rows touched.
-- Any other error (typo, bad data) fails the test, so a broken test cannot pass by accident.
create function pg_temp.t_denied(p_name text, p_role text, p_uid uuid, p_sql text) returns void language plpgsql as $$
declare r record;
begin
  select * into r from pg_temp.t_exec(p_role, p_uid, p_sql);
  perform pg_temp.t_ok('REFUSED: ' || p_name, r.st = '42501' or (r.st = '00000' and r.cnt = 0),
                       'state=' || r.st || ' rows=' || r.cnt || coalesce(' ' || r.msg, ''));
end $$;

-- Must work and touch at least p_min rows.
create function pg_temp.t_allowed(p_name text, p_role text, p_uid uuid, p_sql text, p_min bigint default 1) returns void language plpgsql as $$
declare r record;
begin
  select * into r from pg_temp.t_exec(p_role, p_uid, p_sql);
  perform pg_temp.t_ok('WORKS: ' || p_name, r.st = '00000' and r.cnt >= p_min,
                       'state=' || r.st || ' rows=' || r.cnt || coalesce(' ' || r.msg, ''));
end $$;

do $test$
declare
  t text; r record; pass int; fail int; report text; v text; raw_a text; raw_b text; key_a uuid;
  ro text; n bigint; missing text := '';
begin
  ---------------------------------------------------------------------------------------------
  -- FIXTURES (written as the database owner, like server code would)
  ---------------------------------------------------------------------------------------------
  insert into auth.users (id, email)
  select pg_temp.sub(x)::uuid, x || '@test.invalid' from unnest(array['{C1}','{C2}','{SA}','{SB}','{SC}','{PA}','{PB}']) x;
  insert into profiles (id, role, first_name, username) values
    (pg_temp.sub('{C1}')::uuid, 'coach', 'CoachOne', 'coachone'), (pg_temp.sub('{C2}')::uuid, 'coach', 'CoachTwo', 'coachtwo'),
    (pg_temp.sub('{SA}')::uuid, 'student', 'StudentA', 'studenta'), (pg_temp.sub('{SB}')::uuid, 'student', 'StudentB', 'studentb'),
    (pg_temp.sub('{SC}')::uuid, 'student', 'StudentC', 'studentc'),
    (pg_temp.sub('{PA}')::uuid, 'parent', 'ParentA', 'parenta'), (pg_temp.sub('{PB}')::uuid, 'parent', 'ParentB', 'parentb');
  insert into student_links (student_id, adult_id, relation) values
    (pg_temp.sub('{SA}')::uuid, pg_temp.sub('{C1}')::uuid, 'coach'), (pg_temp.sub('{SB}')::uuid, pg_temp.sub('{C1}')::uuid, 'coach'),
    (pg_temp.sub('{SC}')::uuid, pg_temp.sub('{C2}')::uuid, 'coach'),
    (pg_temp.sub('{SA}')::uuid, pg_temp.sub('{PA}')::uuid, 'parent'), (pg_temp.sub('{SB}')::uuid, pg_temp.sub('{PB}')::uuid, 'parent');

  -- A waiting parent invite for student B (so the "every student-keyed table" check covers invites).
  insert into invites (code_hash, role, first_name, student_id, expires_at)
  values ('inv-fixture-b', 'parent', 'ParentB2', pg_temp.sub('{SB}')::uuid, now() + interval '1 day');

  perform pg_temp.t_ok('a link must join a student to an adult with the matching role',
    pg_temp.t_val('postgres', null, $$insert into student_links (student_id, adult_id, relation) values ('{SA}','{SB}','parent')$$) like 'ERR:%');

  insert into tasks (id, student_id, date, title, source) values
    (pg_temp.sub('{TA1}')::uuid, pg_temp.sub('{SA}')::uuid, current_date, 'Study Latin', 'student'),
    (pg_temp.sub('{TB1}')::uuid, pg_temp.sub('{SB}')::uuid, current_date, 'Study Greek', 'student'),
    (pg_temp.sub('{TC1}')::uuid, pg_temp.sub('{SC}')::uuid, current_date, 'Study French', 'student');
  insert into tasks (id, student_id, date, title, source, done, done_at, coins, reward_status, value_set_by) values
    (pg_temp.sub('{TA2}')::uuid, pg_temp.sub('{SA}')::uuid, current_date, 'Math worksheet', 'coach', true, now(), 3, 'confirmed', 'coach');
  insert into tasks (id, student_id, date, title, source, source_platform, external_id, due_date, coins, value_set_by) values
    (pg_temp.sub('{TA3}')::uuid, pg_temp.sub('{SA}')::uuid, current_date, 'RSM set 4', 'platform', 'rsm', 'x1', current_date + 2, 3, 'platform');

  -- one row per student-keyed table for both A and B, so "A sees none of B's" is a real test
  foreach t in array array['sa','sb'] loop
    declare sid uuid := pg_temp.sub(case t when 'sa' then '{SA}' else '{SB}' end)::uuid;
            tk uuid := pg_temp.sub(case t when 'sa' then '{TA2}' else '{TB1}' end)::uuid;
            th uuid := pg_temp.sub(case t when 'sa' then '{THA}' else '{THB}' end)::uuid;
            pk uuid := pg_temp.sub(case t when 'sa' then '{PKA}' else '{PKB}' end)::uuid;
            pj uuid := pg_temp.sub(case t when 'sa' then '{PRJA}' else '{PRJB}' end)::uuid;
            pc uuid := pg_temp.sub(case t when 'sa' then '{PCA}' else '{PCB}' end)::uuid;
            ci uuid := pg_temp.sub(case t when 'sa' then '{CIA1}' else '{CIB1}' end)::uuid;
    begin
      insert into student_settings (student_id) values (sid);
      insert into template_items (student_id, weekdays, title) values (sid, '{1,3}', 'Vocab');
      insert into work_sessions (student_id, task_id) values (sid, tk);
      insert into bring_home (student_id, date, label) values (sid, current_date, 'Book');
      insert into collection (student_id, item_id, item_name, rarity, acquired_via)
        values (sid, case t when 'sa' then 'needoh-nice-cube' else 'slow-rise-bread' end, 'Owned ' || t, 'rare', 'box');
      insert into ledger (student_id, kind, amount, status, task_id) values (sid, 'earn', 3, 'confirmed', tk);
      insert into day_results (student_id, date) values (sid, current_date);
      insert into shop_weeks (student_id, week_start, item_ids) values (sid, date_trunc('week', current_date), '{a,b}');
      insert into themes (id, student_id, name) values (th, sid, 'Theme ' || t);
      insert into reward_packs (id, student_id) values (pk, sid);
      insert into catalog_items (id, pack_id, student_id, name, source, status) values (ci, pk, sid, 'Approved ' || t, 'hand_made', 'approved');
      insert into student_setup (student_id, answers) values (sid, '{"likes":"x"}');
      insert into helper_characters (theme_id, student_id, job, name) values (th, sid, 'planner', 'Planner ' || t);
      insert into profile_settings (student_id, tone) values (sid, '{"warm":true}');
      insert into profile_suggestions (student_id, change) values (sid, '{"x":1}');
      insert into skill_events (student_id, kind) values (sid, 'starting');
      insert into projects (id, student_id, title, source) values (pj, sid, 'Project ' || t, 'coach');
      insert into planning_conversations (project_id, student_id, question) values (pj, sid, 'What is it about?');
      insert into plan_changes (id, student_id, kind, summary, made_by) values (pc, sid, 'moved', 'Moved a task', 'helper');
      insert into walkthroughs (student_id, date, outcome) values (sid, current_date, 'did');
      insert into helper_settings (student_id) values (sid);
      insert into tutor_settings (student_id) values (sid);
      insert into tutor_conversations (student_id, sender, content) values (sid, 'student', 'help with ' || t);
      insert into tutor_flags (student_id, pattern) values (sid, 'asks for the answer');
      insert into prize_settings (student_id) values (sid);
      insert into prize_orders (student_id, week_start, item_name, price_cents) values (sid, date_trunc('week', current_date), 'Prize ' || t, 1500);
      insert into proof_checks (task_id, student_id, kind, result) values (tk, sid, 'rules', 'pass');
      insert into task_intake (student_id, typed_name) values (sid, 'study ' || t);
      insert into proof_images (task_id, student_id, storage_path) values (tk, sid, sid || '/p.jpg');
      insert into integrity_flags (student_id, task_id, kind) values (sid, tk, 'too_fast');
      insert into connections (student_id, platform, tier) values (sid, 'rsm', 'manual');
      insert into inbound_addresses (student_id, address) values (sid, t || '@in.test');
      insert into adhd_profiles (student_id, answers) values (sid, jsonb_build_object('secret', t));
      insert into automation_keys (student_id, name, key_hash) values (sid, 'seed ' || t, sha256(convert_to('seed' || t, 'UTF8')));
      insert into chat_usage (user_id, day, count) values (sid, current_date, 1);
      insert into push_tokens (user_id, token) values (sid, 'tok' || t);
      insert into audit_log (action, table_name, student_id) values ('seed', 'x', sid);
    end;
  end loop;
  insert into student_settings (student_id) values (pg_temp.sub('{SC}')::uuid);
  insert into notifications (id, recipient_id, student_id, kind, body) values
    (pg_temp.sub('{NA}')::uuid, pg_temp.sub('{SA}')::uuid, pg_temp.sub('{SA}')::uuid, 'note', 'for A'),
    (pg_temp.sub('{NC1}')::uuid, pg_temp.sub('{C1}')::uuid, pg_temp.sub('{SA}')::uuid, 'finished', 'for coach'),
    (gen_random_uuid(), pg_temp.sub('{PA}')::uuid, pg_temp.sub('{SA}')::uuid, 'finished', 'for parent A'),
    (gen_random_uuid(), pg_temp.sub('{PB}')::uuid, pg_temp.sub('{SB}')::uuid, 'finished', 'for parent B');
  insert into notification_prefs (user_id, kind, channel) values (pg_temp.sub('{C1}')::uuid, 'finished', 'in_app'),
                                                                  (pg_temp.sub('{PB}')::uuid, 'finished', 'in_app');
  insert into push_tokens (user_id, token) values (pg_temp.sub('{C1}')::uuid, 'tokC1');

  ---------------------------------------------------------------------------------------------
  -- 0. THE SHAPE OF THE DATABASE
  ---------------------------------------------------------------------------------------------
  perform pg_temp.t_ok('every table in public has Row Level Security on',
    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
    (select string_agg(c.relname, ',') from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));
  perform pg_temp.t_ok('the signed-out role (anon) has no rights on any table',
    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')),
    (select string_agg(c.relname, ',') from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')));
  perform pg_temp.t_ok('signed-in users have no truncate, references or trigger rights anywhere',
    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'truncate,references,trigger')));
  perform pg_temp.t_ok('no table can be deleted from by a signed-in user except the plain settings tables',
    (select coalesce(string_agg(c.relname, ',' order by c.relname), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'delete'))
    = 'bring_home,catalog_items,connections,helper_characters,helper_settings,notification_prefs,prize_settings,profile_settings,projects,push_tokens,reward_catalog,reward_packs,student_settings,student_setup,template_items,themes,tutor_settings',
    (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'delete')));
  -- Tables where nobody in the app may write a single row (server functions only).
  foreach t in array array['ledger','day_results','shop_weeks','prize_orders','proof_checks','task_intake','proof_images',
      'work_sessions','inbound_addresses','audit_log','chat_usage','tutor_conversations','skill_events','planning_conversations',
      'economy_config','student_links','automation_keys','adhd_profiles'] loop
    perform pg_temp.t_ok('server-only table has no insert, update or delete for signed-in users: ' || t,
      not has_table_privilege('authenticated', ('public.' || t)::regclass, 'insert,update,delete') and
      not has_table_privilege('anon', ('public.' || t)::regclass, 'select,insert,update,delete'));
  end loop;
  perform pg_temp.t_ok('the app can write only these tables at all (tasks and profiles included)',
    (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'insert,update'))
    = 'bring_home,catalog_items,collection,connections,helper_characters,helper_settings,integrity_flags,notification_prefs,notifications,plan_changes,prize_settings,profile_settings,profile_suggestions,profiles,projects,push_tokens,reward_catalog,reward_packs,student_settings,student_setup,tasks,template_items,themes,tutor_flags,tutor_settings,walkthroughs',
    (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'insert,update')));
  perform pg_temp.t_ok('signed-in users hold no read right on the ADHD table or on the key hashes',
    not has_table_privilege('authenticated', 'public.adhd_profiles', 'select')
    and not has_column_privilege('authenticated', 'public.automation_keys', 'key_hash', 'select')
    and has_column_privilege('authenticated', 'public.automation_keys', 'name', 'select'));
  perform pg_temp.t_ok('the column guard is on all 13 tables where students, parents and coaches may write different columns',
    (select string_agg(c.relname, ',' order by c.relname) from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where t.tgname = 't1_guard' and not t.tgisinternal)
    = 'bring_home,collection,connections,helper_settings,integrity_flags,notifications,plan_changes,prize_settings,profile_suggestions,profiles,tasks,tutor_flags,tutor_settings',
    (select string_agg(c.relname, ',' order by c.relname) from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 't1_guard' and not t.tgisinternal));
  perform pg_temp.t_ok('no function in public can be run by the signed-out role',
    not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
    (select string_agg(p.proname, ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')));
  perform pg_temp.t_ok('signed-in users can run only the intended functions',
    (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
      where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute'))
    = 'app_role,authorize_photo_open,can_read_student,create_automation_key,is_coach_of,is_parent_of,read_adhd_profile,revoke_automation_key,save_adhd_profile,session_aal,visible_profile',
    (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
      where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')));
  perform pg_temp.t_ok('every security-definer function pins its search path',
    not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
                and not coalesce(p.proconfig::text like '%search_path%', false)));
  perform pg_temp.t_ok('the proof-photo bucket is private with a size limit',
    exists (select 1 from storage.buckets where id = 'proof-photos' and not public and file_size_limit = 10485760));
  perform pg_temp.t_ok('the shared economy matches PRD 3a (box odds sum to 1, 53 items, shop prices)',
    (select (value->'normal'->>'legendary')::numeric + (value->'normal'->>'rare')::numeric + (value->'normal'->>'uncommon')::numeric + (value->'normal'->>'common')::numeric
          + (value->'sparkle'->>'legendary')::numeric + (value->'sparkle'->>'rare')::numeric + (value->'sparkle'->>'uncommon')::numeric + (value->'sparkle'->>'common')::numeric
       from economy_config where key = 'box_odds') = 2
    and (select count(*) from reward_catalog) = 53
    and (select value->'prices'->>'common' from economy_config where key = 'shop') = '25');

  -- every student-keyed table really has a row for B, otherwise "A sees none of B's rows" proves nothing
  for t in select c.table_name from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.column_name = 'student_id' order by 1 loop
    execute format('select count(*) from public.%I where student_id = %L', t, pg_temp.sub('{SB}')) into n;
    if n = 0 then missing := missing || t || ' '; end if;
  end loop;
  perform pg_temp.t_ok('test data has a row for student B in every student-keyed table', missing = '', 'missing: ' || missing);

  ---------------------------------------------------------------------------------------------
  -- 1. STUDENTS CANNOT SEE EACH OTHER, PARENTS SEE ONLY THEIR CHILD, COACHES ONLY THEIR STUDENTS
  ---------------------------------------------------------------------------------------------
  for t in select c.table_name from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.column_name = 'student_id' order by 1 loop
    perform pg_temp.t_denied('student A cannot read student B rows in ' || t, 'authenticated', pg_temp.sub('{SA}')::uuid, format('select 1 from %I where student_id = %L', t, '{SB}'));
    perform pg_temp.t_denied('student B cannot read student A rows in ' || t, 'authenticated', pg_temp.sub('{SB}')::uuid, format('select 1 from %I where student_id = %L', t, '{SA}'));
    perform pg_temp.t_denied('student C cannot read student A rows in ' || t, 'authenticated', pg_temp.sub('{SC}')::uuid, format('select 1 from %I where student_id = %L', t, '{SA}'));
    perform pg_temp.t_denied('parent A cannot read student B rows in ' || t, 'authenticated', pg_temp.sub('{PA}')::uuid, format('select 1 from %I where student_id = %L', t, '{SB}'));
    perform pg_temp.t_denied('parent B cannot read student A rows in ' || t, 'authenticated', pg_temp.sub('{PB}')::uuid, format('select 1 from %I where student_id = %L', t, '{SA}'));
    perform pg_temp.t_denied('coach 1 cannot read student C rows in ' || t, 'authenticated', pg_temp.sub('{C1}')::uuid, format('select 1 from %I where student_id = %L', t, '{SC}'));
    perform pg_temp.t_denied('coach 2 cannot read student A rows in ' || t, 'authenticated', pg_temp.sub('{C2}')::uuid, format('select 1 from %I where student_id = %L', t, '{SA}'));
    perform pg_temp.t_denied('signed-out visitor cannot read ' || t, 'anon', null, format('select 1 from %I', t));
  end loop;

  -- what a student can read about herself
  foreach t in array array['tasks','template_items','work_sessions','bring_home','student_settings','collection','ledger','day_results',
      'shop_weeks','projects','themes','reward_packs','catalog_items','student_setup','helper_characters','profile_settings',
      'profile_suggestions','plan_changes','skill_events','planning_conversations','helper_settings','tutor_settings','connections',
      'task_intake','walkthroughs','student_links','chat_usage','notifications','economy_config'] loop
    perform pg_temp.t_allowed('student A reads her own ' || t, 'authenticated', pg_temp.sub('{SA}')::uuid, format('select 1 from %I', t));
  end loop;
  -- what a student must NOT read, even about herself
  foreach t in array array['tutor_conversations','tutor_flags','prize_settings','prize_orders','proof_checks','proof_images',
      'integrity_flags','inbound_addresses','audit_log','automation_keys','adhd_profiles'] loop
    perform pg_temp.t_denied('student A cannot read ' || t || ', even her own', 'authenticated', pg_temp.sub('{SA}')::uuid, format('select 1 from %I', t));
  end loop;
  -- parent A: her child's rows
  foreach t in array array['tasks','template_items','work_sessions','bring_home','student_settings','collection','ledger','day_results',
      'shop_weeks','projects','themes','reward_packs','catalog_items','student_setup','helper_characters','profile_settings',
      'profile_suggestions','plan_changes','skill_events','planning_conversations','helper_settings','tutor_settings','connections',
      'task_intake','tutor_conversations','prize_settings','prize_orders','proof_checks','proof_images','integrity_flags',
      'inbound_addresses','student_links','notifications'] loop
    perform pg_temp.t_allowed('parent A reads her child''s ' || t, 'authenticated', pg_temp.sub('{PA}')::uuid, format('select 1 from %I', t));
  end loop;
  foreach t in array array['tutor_flags','walkthroughs','audit_log','automation_keys','adhd_profiles','chat_usage'] loop
    perform pg_temp.t_denied('parent A cannot read ' || t, 'authenticated', pg_temp.sub('{PA}')::uuid, format('select 1 from %I', t));
  end loop;
  -- coach 1: her students' rows
  foreach t in array array['tasks','template_items','work_sessions','bring_home','student_settings','collection','ledger','day_results',
      'shop_weeks','projects','themes','reward_packs','catalog_items','student_setup','helper_characters','profile_settings',
      'profile_suggestions','plan_changes','skill_events','planning_conversations','helper_settings','tutor_settings','connections',
      'task_intake','tutor_conversations','tutor_flags','prize_settings','prize_orders','proof_checks','proof_images','integrity_flags',
      'inbound_addresses','student_links','notifications','audit_log','automation_keys','reward_catalog'] loop
    perform pg_temp.t_allowed('coach 1 reads her students'' ' || t, 'authenticated', pg_temp.sub('{C1}')::uuid, format('select 1 from %I', t));
  end loop;
  foreach t in array array['walkthroughs','adhd_profiles'] loop
    perform pg_temp.t_denied('coach 1 cannot read ' || t || ' directly', 'authenticated', pg_temp.sub('{C1}')::uuid, format('select 1 from %I', t));
  end loop;

  -- counts, not just "some"
  perform pg_temp.t_ok('student A sees exactly her 3 tasks (not B''s, not C''s)', pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select count(*) from tasks') = '3');
  perform pg_temp.t_ok('coach 1 sees tasks of A and B only (4)', pg_temp.t_val('authenticated', pg_temp.sub('{C1}')::uuid, 'select count(*) from tasks') = '4');
  perform pg_temp.t_ok('coach 2 sees only student C''s task (1)', pg_temp.t_val('authenticated', pg_temp.sub('{C2}')::uuid, 'select count(*) from tasks') = '1');
  perform pg_temp.t_ok('parent A sees only A''s tasks (3)', pg_temp.t_val('authenticated', pg_temp.sub('{PA}')::uuid, 'select count(*) from tasks') = '3');
  perform pg_temp.t_ok('a student sees only the items she owns in the item list (1 of 53)',
    pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select count(*) from reward_catalog') = '1'
    and pg_temp.t_val('authenticated', pg_temp.sub('{SB}')::uuid, 'select id from reward_catalog') = 'slow-rise-bread');
  perform pg_temp.t_ok('a parent sees no item list', pg_temp.t_val('authenticated', pg_temp.sub('{PA}')::uuid, 'select count(*) from reward_catalog') = '0');
  perform pg_temp.t_ok('a student sees only the people she should: herself and her own adults',
    pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select string_agg(first_name, '','' order by first_name) from profiles') = 'CoachOne,ParentA,StudentA');
  perform pg_temp.t_ok('a parent sees herself, her child and the coach, not other families',
    pg_temp.t_val('authenticated', pg_temp.sub('{PA}')::uuid, 'select string_agg(first_name, '','' order by first_name) from profiles') = 'CoachOne,ParentA,StudentA');
  perform pg_temp.t_ok('coach 2 sees herself and student C only',
    pg_temp.t_val('authenticated', pg_temp.sub('{C2}')::uuid, 'select string_agg(first_name, '','' order by first_name) from profiles') = 'CoachTwo,StudentC');
  perform pg_temp.t_ok('a student sees only her own approved shop items',
    pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select count(*) from catalog_items') = '1');
  perform pg_temp.t_allowed('a proposed catalog item exists (control)', 'postgres', null,
    $$insert into catalog_items (id, pack_id, student_id, name, source) values ('{CIA2}','{PKA}','{SA}','Proposed A','web_search')$$);
  perform pg_temp.t_ok('a student does not see a proposed (unapproved) item, her parent does',
    pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select count(*) from catalog_items') = '1'
    and pg_temp.t_val('authenticated', pg_temp.sub('{PA}')::uuid, 'select count(*) from catalog_items') = '2');
  perform pg_temp.t_ok('notifications go only to their recipient',
    pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select count(*) from notifications') = '1'
    and pg_temp.t_val('authenticated', pg_temp.sub('{PA}')::uuid, 'select count(*) from notifications') = '1'
    and pg_temp.t_val('authenticated', pg_temp.sub('{C1}')::uuid, 'select count(*) from notifications') = '1'
    and pg_temp.t_val('authenticated', pg_temp.sub('{C2}')::uuid, 'select count(*) from notifications') = '0');
  perform pg_temp.t_ok('audit log: a coach sees only her own students'' entries',
    pg_temp.t_val('authenticated', pg_temp.sub('{C2}')::uuid, 'select count(*) from audit_log where student_id <> ''{SC}''') = '0'
    and pg_temp.t_val('authenticated', pg_temp.sub('{C1}')::uuid, 'select count(*) from audit_log where student_id = ''{SC}''') = '0');

  ---------------------------------------------------------------------------------------------
  -- 2. A STUDENT CANNOT FORGE COINS, DONE-STATE, REVIEWS OR VERIFIED STATUS
  ---------------------------------------------------------------------------------------------
  ro := 'authenticated';
  perform pg_temp.t_allowed('student A edits her own task title', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set title = 'Study Latin ch 2' where id = '{TA1}'$$);
  perform pg_temp.t_allowed('student A edits note, color, order and first step', ro, pg_temp.sub('{SA}')::uuid,
    $$update tasks set note = 'n', color_step = 2, sort_order = 5, first_step = 'open the book', start_plan = 'After dinner, at the table' where id = '{TA1}'$$);
  perform pg_temp.t_allowed('student A puts a task in Not today', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set not_today = true where id = '{TA1}'$$);
  perform pg_temp.t_allowed('student A moves a platform task to another day', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set date = current_date + 1 where id = '{TA3}'$$);
  perform pg_temp.t_ok('moving a task off its day is visible afterwards (original_date stays)',
    pg_temp.t_val('postgres', null, $$select (original_date = current_date and date = current_date + 1)::text from tasks where id = '{TA3}'$$) = 'true');
  perform pg_temp.t_allowed('student A adds a plain task for herself', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into tasks (student_id, date, title, note, minutes) values ('{SA}', current_date, 'Read chapter 3', 'n', 20)$$);
  perform pg_temp.t_ok('her new task starts at zero coins, source student, provisional, not done',
    pg_temp.t_val('postgres', null, $$select (coins = 0 and source = 'student' and type = 'school' and reward_status = 'provisional' and not done and verified_by is null and original_date = date)::text from tasks where title = 'Read chapter 3'$$) = 'true');
  perform pg_temp.t_allowed('student A deletes (hides) her own unfinished task', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set deleted = true where title = 'Read chapter 3'$$);

  perform pg_temp.t_denied('A sets her own coins', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set coins = 6 where id = '{TA1}'$$);
  perform pg_temp.t_denied('A marks a task done directly', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set done = true where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets done_at', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set done_at = now() where id = '{TA1}'$$);
  perform pg_temp.t_denied('A writes proof text directly', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set proof_note = 'did it' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A writes a proof photo path directly', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set proof_photo_path = 'x' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A confirms her own rewards', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set reward_status = 'confirmed' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A reviews her own work (looks good)', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set review_status = 'looks_good' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets reviewed_by', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set reviewed_by = '{SA}' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets verified-by-platform', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set verified_by = 'platform' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets verified_at', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set verified_at = now() where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets confirmed_at or final_at', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set confirmed_at = now(), final_at = now() where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets the value-set-by field', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set value_set_by = 'coach' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A rewrites where a task came from', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set source = 'coach' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A turns her task into a no-proof type', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set type = 'flex' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A sets actual minutes', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set actual_minutes = 1 where id = '{TA1}'$$);
  perform pg_temp.t_denied('A changes the original day', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set original_date = current_date + 3 where id = '{TA3}'$$);
  perform pg_temp.t_denied('A hands her task to student B', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set student_id = '{SB}' where id = '{TA1}'$$);
  perform pg_temp.t_denied('A edits a finished task', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set title = 'changed' where id = '{TA2}'$$);
  perform pg_temp.t_denied('A reopens a finished task', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set done = false where id = '{TA2}'$$);
  perform pg_temp.t_denied('A moves the due date a platform set', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set due_date = current_date + 9 where id = '{TA3}'$$);
  perform pg_temp.t_denied('A hides a platform task by deleting it', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set deleted = true where id = '{TA3}'$$);
  perform pg_temp.t_denied('A edits student B''s task', ro, pg_temp.sub('{SA}')::uuid, $$update tasks set title = 'hacked' where id = '{TB1}'$$);
  perform pg_temp.t_denied('A deletes a task row', ro, pg_temp.sub('{SA}')::uuid, $$delete from tasks where id = '{TA1}'$$);
  perform pg_temp.t_denied('A adds a task with coins', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, coins) values ('{SA}', current_date, 'x', 6)$$);
  perform pg_temp.t_denied('A adds a task already done', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, done) values ('{SA}', current_date, 'x', true)$$);
  perform pg_temp.t_denied('A adds a task as if from a platform', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, source) values ('{SA}', current_date, 'x', 'platform')$$);
  perform pg_temp.t_denied('A adds a task as if from her coach', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, source) values ('{SA}', current_date, 'x', 'coach')$$);
  perform pg_temp.t_denied('A adds a pre-verified task', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, verified_by) values ('{SA}', current_date, 'x', 'platform')$$);
  perform pg_temp.t_denied('A adds a pre-confirmed task', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, reward_status) values ('{SA}', current_date, 'x', 'confirmed')$$);
  perform pg_temp.t_denied('A adds a pre-reviewed task', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, review_status) values ('{SA}', current_date, 'x', 'looks_good')$$);
  perform pg_temp.t_denied('A adds a no-proof task', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, type) values ('{SA}', current_date, 'x', 'flex')$$);
  perform pg_temp.t_denied('A adds a task for student B', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title) values ('{SB}', current_date, 'x')$$);
  perform pg_temp.t_denied('A adds a task with a value-set-by', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, value_set_by) values ('{SA}', current_date, 'x', 'adult')$$);
  perform pg_temp.t_denied('A adds a task with fake proof answers', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, proof_answers) values ('{SA}', current_date, 'x', '{"a":1}')$$);
  perform pg_temp.t_denied('A inserts a task claiming another original day', ro, pg_temp.sub('{SA}')::uuid, $$insert into tasks (student_id, date, title, original_date) values ('{SA}', current_date, 'x', current_date - 5)$$);

  -- rewards, boxes, purchases and logs
  perform pg_temp.t_denied('A adds a ledger entry', ro, pg_temp.sub('{SA}')::uuid, $$insert into ledger (student_id, kind, amount, status) values ('{SA}', 'earn', 100, 'confirmed')$$);
  perform pg_temp.t_denied('A confirms held coins', ro, pg_temp.sub('{SA}')::uuid, $$update ledger set status = 'confirmed'$$);
  perform pg_temp.t_denied('A erases a purchase', ro, pg_temp.sub('{SA}')::uuid, $$delete from ledger$$);
  perform pg_temp.t_denied('A adds an item to her collection', ro, pg_temp.sub('{SA}')::uuid, $$insert into collection (student_id, item_id, item_name, acquired_via) values ('{SA}', 'needoh-ice-baby', 'x', 'box')$$);
  perform pg_temp.t_denied('A renames an owned item', ro, pg_temp.sub('{SA}')::uuid, $$update collection set item_name = 'Legendary', rarity = 'legendary' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('A takes student B''s collection item', ro, pg_temp.sub('{SA}')::uuid, $$update collection set student_id = '{SA}' where student_id = '{SB}'$$);
  perform pg_temp.t_allowed('A reorders her own shelf', ro, pg_temp.sub('{SA}')::uuid, $$update collection set shelf_pos = 4 where student_id = '{SA}'$$);
  perform pg_temp.t_denied('A reorders B''s shelf', ro, pg_temp.sub('{SA}')::uuid, $$update collection set shelf_pos = 4 where student_id = '{SB}'$$);
  perform pg_temp.t_denied('A writes a box result', ro, pg_temp.sub('{SA}')::uuid, $$update day_results set box_earned = true, box_kind = 'full', sparkle = true$$);
  perform pg_temp.t_denied('A adds a box result', ro, pg_temp.sub('{SA}')::uuid, $$insert into day_results (student_id, date, box_earned) values ('{SA}', current_date + 1, true)$$);
  perform pg_temp.t_denied('A changes this week''s shop', ro, pg_temp.sub('{SA}')::uuid, $$update shop_weeks set item_ids = '{x}'$$);
  perform pg_temp.t_denied('A starts a work session (server only)', ro, pg_temp.sub('{SA}')::uuid, $$insert into work_sessions (student_id, task_id, started_at) values ('{SA}', '{TA1}', now() - interval '2 hours')$$);
  perform pg_temp.t_denied('A edits a work session time', ro, pg_temp.sub('{SA}')::uuid, $$update work_sessions set started_at = now() - interval '3 hours'$$);
  perform pg_temp.t_denied('A writes a proof check result', ro, pg_temp.sub('{SA}')::uuid, $$insert into proof_checks (task_id, student_id, kind, result) values ('{TA1}', '{SA}', 'ai', 'pass')$$);
  perform pg_temp.t_denied('A edits her task intake verdict', ro, pg_temp.sub('{SA}')::uuid, $$update task_intake set waiting_for_adult = false, ai_verdict = 'fine'$$);
  perform pg_temp.t_denied('A clears an integrity flag', ro, pg_temp.sub('{SA}')::uuid, $$update integrity_flags set status = 'dismissed'$$);
  perform pg_temp.t_denied('A adds a skill event', ro, pg_temp.sub('{SA}')::uuid, $$insert into skill_events (student_id, kind) values ('{SA}', 'planning')$$);
  perform pg_temp.t_denied('A edits a real prize order', ro, pg_temp.sub('{SA}')::uuid, $$update prize_orders set status = 'placed'$$);
  perform pg_temp.t_denied('A orders a prize', ro, pg_temp.sub('{SA}')::uuid, $$insert into prize_orders (student_id, week_start, item_name, price_cents) values ('{SA}', current_date, 'x', 1)$$);
  perform pg_temp.t_denied('A raises her own prize budget', ro, pg_temp.sub('{SA}')::uuid, $$update prize_settings set weekly_budget_cents = 100000$$);
  perform pg_temp.t_denied('A approves a shop item', ro, pg_temp.sub('{SA}')::uuid, $$update catalog_items set status = 'approved'$$);
  perform pg_temp.t_denied('A adds a shop item', ro, pg_temp.sub('{SA}')::uuid, $$insert into catalog_items (pack_id, student_id, name, source, status) values ('{PKA}', '{SA}', 'x', 'hand_made', 'approved')$$);
  perform pg_temp.t_denied('A changes the item list', ro, pg_temp.sub('{SA}')::uuid, $$update reward_catalog set rarity = 'common', price_usd = 0$$);
  perform pg_temp.t_denied('A adds to the item list', ro, pg_temp.sub('{SA}')::uuid, $$insert into reward_catalog (id, name, kind, rarity, price_usd, cat) values ('free', 'x', 'x', 'common', 0, 'shelf')$$);
  perform pg_temp.t_denied('A changes the shared economy', ro, pg_temp.sub('{SA}')::uuid, $$update economy_config set value = '{"normal":{"legendary":1}}' where key = 'box_odds'$$);
  perform pg_temp.t_denied('A writes the audit log', ro, pg_temp.sub('{SA}')::uuid, $$insert into audit_log (action) values ('x')$$);
  perform pg_temp.t_denied('A changes her proof strictness', ro, pg_temp.sub('{SA}')::uuid, $$update student_settings set proof_strictness = 'gentle', no_proof_types = '{test,school,hunter,rsm,fixed,flex}'$$);
  perform pg_temp.t_denied('A changes her template', ro, pg_temp.sub('{SA}')::uuid, $$update template_items set title = 'x'$$);
  perform pg_temp.t_denied('A changes her theme', ro, pg_temp.sub('{SA}')::uuid, $$update themes set name = 'x'$$);
  perform pg_temp.t_denied('A turns on her own helper autonomy', ro, pg_temp.sub('{SA}')::uuid, $$update helper_settings set autonomy = 'everything', daily_call_budget = 500$$);
  perform pg_temp.t_denied('A gives her own consent for the helper', ro, pg_temp.sub('{SA}')::uuid, $$update helper_settings set chat_consent = true$$);
  perform pg_temp.t_denied('A gives her own consent for the tutor', ro, pg_temp.sub('{SA}')::uuid, $$update tutor_settings set consent_given = true$$);
  perform pg_temp.t_denied('A connects a platform', ro, pg_temp.sub('{SA}')::uuid, $$insert into connections (student_id, platform, tier, parent_consent) values ('{SA}', 'x', 'manual', true)$$);
  perform pg_temp.t_denied('A edits her derived ADHD settings', ro, pg_temp.sub('{SA}')::uuid, $$update profile_settings set tone = '{}'$$);
  perform pg_temp.t_denied('A approves a profile suggestion', ro, pg_temp.sub('{SA}')::uuid, $$update profile_suggestions set status = 'approved'$$);
  perform pg_temp.t_denied('A edits a project''s due date', ro, pg_temp.sub('{SA}')::uuid, $$update projects set due_date = current_date + 30$$);
  perform pg_temp.t_denied('A edits a plan change''s content', ro, pg_temp.sub('{SA}')::uuid, $$update plan_changes set summary = 'x', status = 'applied'$$);
  perform pg_temp.t_allowed('A acknowledges a plan change', ro, pg_temp.sub('{SA}')::uuid, $$update plan_changes set acknowledged_at = now() where id = '{PCA}'$$);
  perform pg_temp.t_denied('A acknowledges B''s plan change', ro, pg_temp.sub('{SA}')::uuid, $$update plan_changes set acknowledged_at = now() where id = '{PCB}'$$);
  perform pg_temp.t_allowed('A records a walk-through for herself', ro, pg_temp.sub('{SA}')::uuid, $$insert into walkthroughs (student_id, date, outcome) values ('{SA}', current_date + 1, 'skipped')$$);
  perform pg_temp.t_denied('A records a walk-through for B', ro, pg_temp.sub('{SA}')::uuid, $$insert into walkthroughs (student_id, date, outcome) values ('{SB}', current_date + 1, 'did')$$);

  -- notifications and her phone
  perform pg_temp.t_allowed('A marks her own alert read', ro, pg_temp.sub('{SA}')::uuid, $$update notifications set read_at = now() where id = '{NA}'$$);
  perform pg_temp.t_denied('A rewrites an alert', ro, pg_temp.sub('{SA}')::uuid, $$update notifications set body = 'x' where id = '{NA}'$$);
  perform pg_temp.t_denied('A marks the coach''s alert read', ro, pg_temp.sub('{SA}')::uuid, $$update notifications set read_at = now() where id = '{NC1}'$$);
  perform pg_temp.t_denied('A sends an alert', ro, pg_temp.sub('{SA}')::uuid, $$insert into notifications (recipient_id, student_id, kind, body) values ('{C1}', '{SA}', 'finished', 'Emma finished everything')$$);
  perform pg_temp.t_allowed('A sets her own alert preference', ro, pg_temp.sub('{SA}')::uuid, $$insert into notification_prefs (user_id, kind, channel) values ('{SA}', 'x', 'in_app')$$);
  perform pg_temp.t_denied('A sets student B''s alert preference', ro, pg_temp.sub('{SA}')::uuid, $$insert into notification_prefs (user_id, kind, channel) values ('{SB}', 'x', 'in_app')$$);
  perform pg_temp.t_denied('A turns off the coach''s alerts', ro, pg_temp.sub('{SA}')::uuid, $$update notification_prefs set enabled = false where user_id = '{C1}'$$);
  perform pg_temp.t_allowed('A registers her own phone', ro, pg_temp.sub('{SA}')::uuid, $$insert into push_tokens (user_id, token) values ('{SA}', 'new-token')$$);
  perform pg_temp.t_denied('A registers a phone for B', ro, pg_temp.sub('{SA}')::uuid, $$insert into push_tokens (user_id, token) values ('{SB}', 'steal')$$);
  perform pg_temp.t_denied('A reads another person''s phone token', ro, pg_temp.sub('{SA}')::uuid, $$select 1 from push_tokens where user_id = '{C1}'$$);

  -- people and links
  perform pg_temp.t_denied('A edits her own profile', ro, pg_temp.sub('{SA}')::uuid, $$update profiles set first_name = 'x' where id = '{SA}'$$);
  perform pg_temp.t_denied('A makes herself a coach', ro, pg_temp.sub('{SA}')::uuid, $$update profiles set role = 'coach' where id = '{SA}'$$);
  perform pg_temp.t_denied('A moves her time zone', ro, pg_temp.sub('{SA}')::uuid, $$update profiles set time_zone = 'Pacific/Kiritimati' where id = '{SA}'$$);
  perform pg_temp.t_denied('A creates a profile', ro, pg_temp.sub('{SA}')::uuid, $$insert into profiles (id, role, first_name) values (gen_random_uuid(), 'coach', 'x')$$);
  perform pg_temp.t_denied('A links herself to student B', ro, pg_temp.sub('{SA}')::uuid, $$insert into student_links (student_id, adult_id, relation) values ('{SB}', '{SA}', 'parent')$$);
  perform pg_temp.t_denied('A deletes a link', ro, pg_temp.sub('{SA}')::uuid, $$delete from student_links$$);

  -- the sensitive profile and the keys
  perform pg_temp.t_ok('A reads her own ADHD profile through the function', pg_temp.t_val(ro, pg_temp.sub('{SA}')::uuid, $$select read_adhd_profile('{SA}')->'answers'->>'secret'$$) = 'sa');
  perform pg_temp.t_ok('that read is in the audit log',
    (select count(*) from audit_log where action = 'read' and table_name = 'adhd_profiles' and student_id = pg_temp.sub('{SA}')::uuid and actor_id = pg_temp.sub('{SA}')::uuid) = 1);
  perform pg_temp.t_denied('A reads B''s ADHD profile', ro, pg_temp.sub('{SA}')::uuid, $$select read_adhd_profile('{SB}')$$);
  perform pg_temp.t_denied('A writes B''s ADHD profile', ro, pg_temp.sub('{SA}')::uuid, $$select save_adhd_profile('{SB}', '{"x":1}')$$);
  perform pg_temp.t_denied('A records consent for the Helper', ro, pg_temp.sub('{SA}')::uuid, $$select save_adhd_profile('{SA}', '{"x":1}', true, true)$$);
  perform pg_temp.t_allowed('A saves her own "How I work" answers', ro, pg_temp.sub('{SA}')::uuid, $$select save_adhd_profile('{SA}', '{"starting":"hard"}')$$);
  perform pg_temp.t_denied('A reads the ADHD table directly', ro, pg_temp.sub('{SA}')::uuid, $$select * from adhd_profiles$$);
  perform pg_temp.t_denied('A writes the ADHD table directly', ro, pg_temp.sub('{SA}')::uuid, $$update adhd_profiles set answers = '{}'$$);
  perform pg_temp.t_denied('A makes an automation key', ro, pg_temp.sub('{SA}')::uuid, $$select create_automation_key('{SA}', 'mine')$$);
  perform pg_temp.t_denied('A revokes a key', ro, pg_temp.sub('{SA}')::uuid, $$select revoke_automation_key(id) from automation_keys$$);
  perform pg_temp.t_denied('A reads a key hash', ro, pg_temp.sub('{SA}')::uuid, $$select key_hash from automation_keys$$);
  perform pg_temp.t_denied('A opens a proof photo', ro, pg_temp.sub('{SA}')::uuid, $$select authorize_photo_open('{SA}/x/p.jpg')$$);
  perform pg_temp.t_denied('A calls the automation functions directly', ro, pg_temp.sub('{SA}')::uuid, $$select automation_student_for_key('seeda')$$);
  perform pg_temp.t_denied('A tries to add tasks through the automation function', ro, pg_temp.sub('{SA}')::uuid,
    $$select automation_upsert_task('seeda', 'rsm', 'e1', 'free coins', current_date, null, null, null, true, null)$$);

  ---------------------------------------------------------------------------------------------
  -- 3. PARENTS: READ THEIR CHILD, WRITE ONLY A SHORT LIST
  ---------------------------------------------------------------------------------------------
  ro := 'authenticated';
  perform pg_temp.t_denied('parent edits a task', ro, pg_temp.sub('{PA}')::uuid, $$update tasks set title = 'x' where id = '{TA1}'$$);
  perform pg_temp.t_denied('parent adds a task', ro, pg_temp.sub('{PA}')::uuid, $$insert into tasks (student_id, date, title) values ('{SA}', current_date, 'x')$$);
  perform pg_temp.t_denied('parent adds a task with coins', ro, pg_temp.sub('{PA}')::uuid, $$insert into tasks (student_id, date, title, coins, source) values ('{SA}', current_date, 'x', 6, 'coach')$$);
  perform pg_temp.t_denied('parent marks a task looks good directly', ro, pg_temp.sub('{PA}')::uuid, $$update tasks set review_status = 'looks_good', reward_status = 'confirmed' where id = '{TA1}'$$);
  perform pg_temp.t_denied('parent writes the ledger', ro, pg_temp.sub('{PA}')::uuid, $$insert into ledger (student_id, kind, amount, status) values ('{SA}', 'earn', 50, 'confirmed')$$);
  perform pg_temp.t_denied('parent edits the collection', ro, pg_temp.sub('{PA}')::uuid, $$update collection set shelf_pos = 9$$);
  perform pg_temp.t_denied('parent edits settings (proof strictness)', ro, pg_temp.sub('{PA}')::uuid, $$update student_settings set proof_strictness = 'gentle'$$);
  perform pg_temp.t_denied('parent edits the theme', ro, pg_temp.sub('{PA}')::uuid, $$update themes set name = 'x'$$);
  perform pg_temp.t_denied('parent edits the template', ro, pg_temp.sub('{PA}')::uuid, $$update template_items set title = 'x'$$);
  perform pg_temp.t_denied('parent approves a catalog item', ro, pg_temp.sub('{PA}')::uuid, $$update catalog_items set status = 'approved' where id = '{CIA2}'$$);
  perform pg_temp.t_denied('parent edits the item list', ro, pg_temp.sub('{PA}')::uuid, $$update reward_catalog set price_usd = 0$$);
  perform pg_temp.t_denied('parent changes the tutor videos setting', ro, pg_temp.sub('{PA}')::uuid, $$update tutor_settings set videos_on = true$$);
  perform pg_temp.t_denied('parent turns the helper chat on', ro, pg_temp.sub('{PA}')::uuid, $$update helper_settings set chat_on = true$$);
  perform pg_temp.t_denied('parent changes helper autonomy', ro, pg_temp.sub('{PA}')::uuid, $$update helper_settings set autonomy = 'everything'$$);
  perform pg_temp.t_denied('parent changes a connection''s status', ro, pg_temp.sub('{PA}')::uuid, $$update connections set status = 'working'$$);
  perform pg_temp.t_denied('parent adds a connection', ro, pg_temp.sub('{PA}')::uuid, $$insert into connections (student_id, platform, tier) values ('{SA}', 'x', 'manual')$$);
  perform pg_temp.t_denied('parent edits tutor conversations', ro, pg_temp.sub('{PA}')::uuid, $$update tutor_conversations set content = 'x'$$);
  perform pg_temp.t_denied('parent deletes tutor conversations', ro, pg_temp.sub('{PA}')::uuid, $$delete from tutor_conversations$$);
  perform pg_temp.t_denied('parent edits an integrity flag', ro, pg_temp.sub('{PA}')::uuid, $$update integrity_flags set status = 'dismissed'$$);
  perform pg_temp.t_denied('parent edits a prize order', ro, pg_temp.sub('{PA}')::uuid, $$update prize_orders set status = 'placed'$$);
  perform pg_temp.t_denied('parent places an order', ro, pg_temp.sub('{PA}')::uuid, $$insert into prize_orders (student_id, week_start, item_name, price_cents) values ('{SA}', current_date, 'x', 1)$$);
  perform pg_temp.t_denied('parent changes her child''s role or name', ro, pg_temp.sub('{PA}')::uuid, $$update profiles set first_name = 'x' where id = '{SA}'$$);
  perform pg_temp.t_denied('parent makes herself a coach', ro, pg_temp.sub('{PA}')::uuid, $$update profiles set role = 'coach' where id = '{PA}'$$);
  perform pg_temp.t_denied('parent links herself to another child', ro, pg_temp.sub('{PA}')::uuid, $$insert into student_links (student_id, adult_id, relation) values ('{SB}', '{PA}', 'parent')$$);
  perform pg_temp.t_denied('parent makes an automation key', ro, pg_temp.sub('{PA}')::uuid, $$select create_automation_key('{SA}', 'x')$$);
  perform pg_temp.t_denied('parent reads the ADHD table directly', ro, pg_temp.sub('{PA}')::uuid, $$select * from adhd_profiles$$);

  perform pg_temp.t_allowed('parent changes the prize budget and buying method', ro, pg_temp.sub('{PA}')::uuid,
    $$update prize_settings set weekly_budget_cents = 2500, buying_method = 'one_tap', cancel_delay_minutes = 60, allow_over_budget = false where student_id = '{SA}'$$);
  perform pg_temp.t_ok('the app records who set the budget (and cannot be told otherwise)',
    pg_temp.t_val('postgres', null, $$select (set_by = '{PA}' and set_at is not null and weekly_budget_cents = 2500)::text from prize_settings where student_id = '{SA}'$$) = 'true');
  perform pg_temp.t_denied('parent forges "who set the budget"', ro, pg_temp.sub('{PA}')::uuid, $$update prize_settings set set_by = '{C1}' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('parent changes another family''s budget', ro, pg_temp.sub('{PA}')::uuid, $$update prize_settings set weekly_budget_cents = 1 where student_id = '{SB}'$$);
  perform pg_temp.t_ok('a budget above the allowed maximum is rejected',
    pg_temp.t_val(ro, pg_temp.sub('{PA}')::uuid, $$update prize_settings set weekly_budget_cents = 9999999 where student_id = '{SA}'$$) = 'ERR:23514');
  perform pg_temp.t_allowed('parent records consent for the helper chat', ro, pg_temp.sub('{PA}')::uuid, $$update helper_settings set chat_consent = true where student_id = '{SA}'$$);
  perform pg_temp.t_ok('the app records who consented and when',
    pg_temp.t_val('postgres', null, $$select (chat_consent_by = '{PA}' and chat_consent_at is not null)::text from helper_settings where student_id = '{SA}'$$) = 'true');
  perform pg_temp.t_denied('parent forges the consent record', ro, pg_temp.sub('{PA}')::uuid, $$update helper_settings set chat_consent_by = '{C1}' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('parent records consent for another family', ro, pg_temp.sub('{PA}')::uuid, $$update helper_settings set chat_consent = true where student_id = '{SB}'$$);
  perform pg_temp.t_allowed('parent records consent for the tutor', ro, pg_temp.sub('{PA}')::uuid, $$update tutor_settings set consent_given = true where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('parent records consent for a connection', ro, pg_temp.sub('{PA}')::uuid, $$update connections set parent_consent = true where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('parent sets her own alert choices', ro, pg_temp.sub('{PA}')::uuid, $$insert into notification_prefs (user_id, kind, channel, enabled) values ('{PA}', 'day_cleared', 'push', true)$$);
  perform pg_temp.t_denied('parent changes another parent''s alert choices', ro, pg_temp.sub('{PA}')::uuid, $$update notification_prefs set enabled = false where user_id = '{PB}'$$);
  perform pg_temp.t_allowed('parent marks her own alert read', ro, pg_temp.sub('{PA}')::uuid, $$update notifications set read_at = now()$$);
  perform pg_temp.t_allowed('parent edits her own first name', ro, pg_temp.sub('{PA}')::uuid, $$update profiles set first_name = 'ParentA' where id = '{PA}'$$);
  perform pg_temp.t_allowed('parent reads her child''s ADHD profile through the function', ro, pg_temp.sub('{PA}')::uuid, $$select read_adhd_profile('{SA}')$$);
  perform pg_temp.t_denied('parent reads another child''s ADHD profile', ro, pg_temp.sub('{PA}')::uuid, $$select read_adhd_profile('{SB}')$$);
  perform pg_temp.t_allowed('parent records consent for storing the profile and the Helper', ro, pg_temp.sub('{PA}')::uuid, $$select save_adhd_profile('{SA}', '{"time":"mornings are best"}', true, true)$$);
  perform pg_temp.t_ok('the consent is stamped with the parent and a time',
    pg_temp.t_val('postgres', null, $$select (consent_stored and consent_helper and consent_stored_by = '{PA}' and consent_helper_by = '{PA}' and filled_by = 'parent' and version >= 3)::text from adhd_profiles where student_id = '{SA}'$$) = 'true');
  perform pg_temp.t_denied('parent records consent for another family''s child', ro, pg_temp.sub('{PA}')::uuid, $$select save_adhd_profile('{SB}', '{}', true, true)$$);
  perform pg_temp.t_allowed('parent opens a photo of her own child', ro, pg_temp.sub('{PA}')::uuid, $$select authorize_photo_open('{SA}/x/p.jpg')$$);
  perform pg_temp.t_ok('that open is in the audit log',
    (select count(*) from audit_log where action = 'open_photo' and actor_id = pg_temp.sub('{PA}')::uuid and student_id = pg_temp.sub('{SA}')::uuid) = 1);
  perform pg_temp.t_denied('parent opens a photo of another child', ro, pg_temp.sub('{PA}')::uuid, $$select authorize_photo_open('{SB}/x/p.jpg')$$);
  perform pg_temp.t_denied('a photo path that is not a student folder is refused', ro, pg_temp.sub('{PA}')::uuid, $$select authorize_photo_open('../../etc/passwd')$$);

  ---------------------------------------------------------------------------------------------
  -- 4. COACHES: RUN THEIR OWN STUDENTS, NOTHING ELSE, AND NO FORGING
  ---------------------------------------------------------------------------------------------
  perform pg_temp.t_allowed('coach 1 adds a task for student A', ro, pg_temp.sub('{C1}')::uuid,
    $$insert into tasks (student_id, date, title, source, value_set_by, coins, type) values ('{SA}', current_date, 'Coach task', 'coach', 'coach', 4, 'school')$$);
  perform pg_temp.t_allowed('coach 1 edits a task of A', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set title = 'Latin vocab', coins = 5, note = 'by Friday' where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach 1 adds a task for student C', ro, pg_temp.sub('{C1}')::uuid, $$insert into tasks (student_id, date, title, source) values ('{SC}', current_date, 'x', 'coach')$$);
  perform pg_temp.t_denied('coach 1 edits a task of student C', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set title = 'x' where id = '{TC1}'$$);
  perform pg_temp.t_denied('coach 2 edits a task of student A', ro, pg_temp.sub('{C2}')::uuid, $$update tasks set title = 'x' where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach adds a task pretending to be a platform', ro, pg_temp.sub('{C1}')::uuid, $$insert into tasks (student_id, date, title, source) values ('{SA}', current_date, 'x', 'platform')$$);
  perform pg_temp.t_denied('coach adds a task that is already verified', ro, pg_temp.sub('{C1}')::uuid, $$insert into tasks (student_id, date, title, source, verified_by) values ('{SA}', current_date, 'x', 'coach', 'platform')$$);
  perform pg_temp.t_denied('coach adds a task that is already done', ro, pg_temp.sub('{C1}')::uuid, $$insert into tasks (student_id, date, title, source, done) values ('{SA}', current_date, 'x', 'coach', true)$$);
  perform pg_temp.t_denied('coach marks a task done directly', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set done = true where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach confirms rewards directly (must use the review step)', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set reward_status = 'confirmed' where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach writes review fields directly', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set review_status = 'not_done', reviewed_by = '{C1}' where id = '{TA2}'$$);
  perform pg_temp.t_denied('coach marks a task verified-by-platform', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set verified_by = 'platform' where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach changes the coins of a finished task', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set coins = 6 where id = '{TA2}'$$);
  perform pg_temp.t_denied('coach turns a student task into a template task', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set source = 'template' where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach moves a task to another student', ro, pg_temp.sub('{C1}')::uuid, $$update tasks set student_id = '{SC}' where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach deletes a task row', ro, pg_temp.sub('{C1}')::uuid, $$delete from tasks where id = '{TA1}'$$);
  perform pg_temp.t_denied('coach writes the ledger', ro, pg_temp.sub('{C1}')::uuid, $$insert into ledger (student_id, kind, amount, status) values ('{SA}', 'earn', 99, 'confirmed')$$);
  perform pg_temp.t_denied('coach edits the ledger', ro, pg_temp.sub('{C1}')::uuid, $$update ledger set amount = 99$$);
  perform pg_temp.t_denied('coach writes the collection', ro, pg_temp.sub('{C1}')::uuid, $$insert into collection (student_id, item_id, item_name, acquired_via) values ('{SA}', 'x', 'x', 'gift')$$);
  perform pg_temp.t_denied('coach opens a box by writing a day result', ro, pg_temp.sub('{C1}')::uuid, $$update day_results set opened = true$$);
  perform pg_temp.t_denied('coach places an order', ro, pg_temp.sub('{C1}')::uuid, $$insert into prize_orders (student_id, week_start, item_name, price_cents) values ('{SA}', current_date, 'x', 1)$$);
  perform pg_temp.t_denied('coach writes a proof check', ro, pg_temp.sub('{C1}')::uuid, $$insert into proof_checks (task_id, student_id, kind, result) values ('{TA1}', '{SA}', 'ai', 'pass')$$);
  perform pg_temp.t_denied('coach edits the audit log', ro, pg_temp.sub('{C1}')::uuid, $$update audit_log set action = 'x'$$);
  perform pg_temp.t_denied('coach deletes the audit log', ro, pg_temp.sub('{C1}')::uuid, $$delete from audit_log$$);
  perform pg_temp.t_denied('coach edits a tutor conversation', ro, pg_temp.sub('{C1}')::uuid, $$update tutor_conversations set content = 'x'$$);
  perform pg_temp.t_denied('coach changes the shared economy', ro, pg_temp.sub('{C1}')::uuid, $$update economy_config set value = '{}'$$);
  perform pg_temp.t_denied('coach creates a link to a student', ro, pg_temp.sub('{C1}')::uuid, $$insert into student_links (student_id, adult_id, relation) values ('{SC}', '{C1}', 'coach')$$);
  perform pg_temp.t_denied('coach makes herself a parent', ro, pg_temp.sub('{C1}')::uuid, $$update profiles set role = 'parent' where id = '{C1}'$$);
  perform pg_temp.t_denied('coach makes a student a coach', ro, pg_temp.sub('{C1}')::uuid, $$update profiles set role = 'coach' where id = '{SA}'$$);
  perform pg_temp.t_denied('coach edits student C''s profile', ro, pg_temp.sub('{C1}')::uuid, $$update profiles set first_name = 'x' where id = '{SC}'$$);
  perform pg_temp.t_allowed('coach edits her student''s first name and time zone', ro, pg_temp.sub('{C1}')::uuid, $$update profiles set first_name = 'StudentA', time_zone = 'America/New_York' where id = '{SA}'$$);
  perform pg_temp.t_allowed('coach changes proof strictness for A', ro, pg_temp.sub('{C1}')::uuid, $$update student_settings set proof_strictness = 'strict' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('coach changes proof strictness for student C', ro, pg_temp.sub('{C1}')::uuid, $$update student_settings set proof_strictness = 'gentle' where student_id = '{SC}'$$);
  perform pg_temp.t_allowed('coach adds a template item for A', ro, pg_temp.sub('{C1}')::uuid, $$insert into template_items (student_id, weekdays, title) values ('{SA}', '{2}', 'Piano')$$);
  perform pg_temp.t_denied('coach adds a template item for student C', ro, pg_temp.sub('{C1}')::uuid, $$insert into template_items (student_id, weekdays, title) values ('{SC}', '{2}', 'Piano')$$);
  perform pg_temp.t_allowed('coach edits A''s theme and colors', ro, pg_temp.sub('{C1}')::uuid, $$update themes set color_system = '{"mode":"urgency_ladder","steps":[{"color":"#a78bfa","name":"Tonight","meaning":"due tonight"}]}' where id = '{THA}'$$);
  perform pg_temp.t_denied('coach edits student B''s theme as the wrong coach', ro, pg_temp.sub('{C2}')::uuid, $$update themes set name = 'x' where id = '{THB}'$$);
  perform pg_temp.t_allowed('coach adds an item to the item list', ro, pg_temp.sub('{C1}')::uuid, $$insert into reward_catalog (id, name, kind, rarity, price_usd, cat) values ('new-item', 'New item', 'cube', 'common', 5, 'shelf')$$);
  perform pg_temp.t_allowed('coach approves a catalog item', ro, pg_temp.sub('{C1}')::uuid, $$update catalog_items set status = 'approved', approved_by = '{C2}' where id = '{CIA2}'$$);
  perform pg_temp.t_ok('the approval is stamped with the real approver, whatever she typed',
    pg_temp.t_val('postgres', null, $$select (approved_by = '{C1}' and approved_at is not null)::text from catalog_items where id = '{CIA2}'$$) = 'true');
  perform pg_temp.t_ok('and a student now sees the approved item', pg_temp.t_val('authenticated', pg_temp.sub('{SA}')::uuid, 'select count(*) from catalog_items') = '2');
  perform pg_temp.t_denied('coach records the parent''s consent for the helper', ro, pg_temp.sub('{C1}')::uuid, $$update helper_settings set chat_consent = true where student_id = '{SB}'$$);
  perform pg_temp.t_denied('coach records the parent''s consent for the tutor', ro, pg_temp.sub('{C1}')::uuid, $$update tutor_settings set consent_given = true where student_id = '{SB}'$$);
  perform pg_temp.t_denied('coach records the parent''s consent for a connection', ro, pg_temp.sub('{C1}')::uuid, $$update connections set parent_consent = true where student_id = '{SB}'$$);
  perform pg_temp.t_denied('coach records consent in the ADHD profile', ro, pg_temp.sub('{C1}')::uuid, $$select save_adhd_profile('{SB}', '{}', true, true)$$);
  perform pg_temp.t_allowed('coach changes helper autonomy', ro, pg_temp.sub('{C1}')::uuid, $$update helper_settings set autonomy = 'small_moves' where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('coach reads the ADHD profile of her student through the function', ro, pg_temp.sub('{C1}')::uuid, $$select read_adhd_profile('{SA}')$$);
  perform pg_temp.t_denied('coach reads another coach''s student''s ADHD profile', ro, pg_temp.sub('{C1}')::uuid, $$select read_adhd_profile('{SC}')$$);
  perform pg_temp.t_allowed('coach approves a profile suggestion', ro, pg_temp.sub('{C1}')::uuid, $$update profile_suggestions set status = 'approved' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('coach rewrites a profile suggestion''s content', ro, pg_temp.sub('{C1}')::uuid, $$update profile_suggestions set change = '{"x":2}' where student_id = '{SB}'$$);
  perform pg_temp.t_allowed('coach marks a tutor flag seen', ro, pg_temp.sub('{C1}')::uuid, $$update tutor_flags set status = 'seen' where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('coach marks an integrity flag seen', ro, pg_temp.sub('{C1}')::uuid, $$update integrity_flags set status = 'seen' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('coach rewrites an integrity flag', ro, pg_temp.sub('{C1}')::uuid, $$update integrity_flags set kind = 'other' where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('coach makes an automation key for A', ro, pg_temp.sub('{C1}')::uuid, $$select create_automation_key('{SA}', 'RSM pull')$$);
  perform pg_temp.t_denied('coach makes an automation key for student C', ro, pg_temp.sub('{C1}')::uuid, $$select create_automation_key('{SC}', 'x')$$);
  perform pg_temp.t_denied('coach 2 makes an automation key for A', ro, pg_temp.sub('{C2}')::uuid, $$select create_automation_key('{SA}', 'x')$$);
  perform pg_temp.t_denied('coach reads a key hash', ro, pg_temp.sub('{C1}')::uuid, $$select key_hash from automation_keys$$);
  perform pg_temp.t_allowed('coach lists the keys of her students (not the hash)', ro, pg_temp.sub('{C1}')::uuid, $$select id, name, revoked_at from automation_keys$$, 2);
  perform pg_temp.t_ok('coach 1 sees keys of A and B only, coach 2 none of theirs',
    pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, 'select count(*) from automation_keys where student_id <> ''{SC}''') >= '2'
    and pg_temp.t_val(ro, pg_temp.sub('{C2}')::uuid, 'select count(*) from automation_keys') = '0');
  perform pg_temp.t_allowed('coach opens a photo of her student', ro, pg_temp.sub('{C1}')::uuid, $$select authorize_photo_open('{SA}/x/p.jpg')$$);
  perform pg_temp.t_denied('coach opens a photo of another coach''s student', ro, pg_temp.sub('{C1}')::uuid, $$select authorize_photo_open('{SC}/x/p.jpg')$$);

  ---------------------------------------------------------------------------------------------
  -- 5. AUTOMATION KEYS (stolen-key scenarios)
  ---------------------------------------------------------------------------------------------
  raw_a := pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, $$select create_automation_key('{SA}', 'key for A')$$);
  raw_b := pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, $$select create_automation_key('{SB}', 'key for B')$$);
  perform pg_temp.t_ok('a key is made and looks like a key', raw_a like 'ek\_%' and length(raw_a) > 60 and raw_a <> raw_b, left(raw_a, 6));
  perform pg_temp.t_ok('the raw key is not stored anywhere, only its hash',
    not exists (select 1 from automation_keys where key_hash = convert_to(raw_a, 'UTF8') or encode(key_hash, 'escape') = raw_a or encode(key_hash, 'hex') = raw_a)
    and exists (select 1 from automation_keys where key_hash = sha256(convert_to(raw_a, 'UTF8'))));
  perform pg_temp.t_ok('a key is not an account: no profile, no login, no token',
    not exists (select 1 from profiles where username = raw_a) and not exists (select 1 from auth.users where email = raw_a));
  perform pg_temp.t_ok('the server key maps key A to student A, and key B to student B',
    pg_temp.t_val('service_role', null, format('select automation_student_for_key(%L)', raw_a)) = pg_temp.sub('{SA}')
    and pg_temp.t_val('service_role', null, format('select automation_student_for_key(%L)', raw_b)) = pg_temp.sub('{SB}'));
  perform pg_temp.t_ok('a made-up key maps to nobody',
    pg_temp.t_val('service_role', null, $$select coalesce(automation_student_for_key('ek_notarealkey')::text, 'nobody')$$) = 'nobody');
  perform pg_temp.t_ok('a signed-in coach cannot use a stolen key through the database',
    pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, format('select automation_student_for_key(%L)', raw_a)) = 'ERR:42501');
  perform pg_temp.t_ok('the signed-out role cannot use a key either',
    pg_temp.t_val('anon', null, format('select automation_student_for_key(%L)', raw_a)) = 'ERR:42501'
    and pg_temp.t_val('anon', null, format($$select automation_upsert_task(%L,'rsm','e1','t',current_date)$$, raw_a)) = 'ERR:42501');
  perform pg_temp.t_ok('a key adds a task for its student, as a platform task, verified',
    pg_temp.t_val('service_role', null, format($$select automation_upsert_task(%L,'rsm','e100','Pull: Algebra set 7',current_date,current_date+3,'from RSM',25,true,'{"submitted":true}')$$, raw_a)) not like 'ERR:%'
    and pg_temp.t_val('postgres', null, $$select (student_id = '{SA}' and source = 'platform' and verified_by = 'platform' and verified_at is not null and coins = 3 and not done and value_set_by = 'platform')::text from tasks where external_id = 'e100'$$) = 'true');
  v := pg_temp.t_val('service_role', null, format($$select automation_upsert_task(%L,'rsm','e100','Pull: Algebra set 7 (new title)',current_date,current_date+4,null,30,false,null)$$, raw_a));
  perform pg_temp.t_ok('pulling the same task again updates it instead of duplicating',
    v not like 'ERR:%'
    and (select count(*) from tasks where external_id = 'e100') = 1
    and (select title from tasks where external_id = 'e100') = 'Pull: Algebra set 7 (new title)',
    coalesce(v, '') || ' / ' || (select string_agg(title || '|' || coalesce(external_id, ''), ' ; ') from tasks where external_id = 'e100'));
  perform pg_temp.t_ok('a key never touches the other student''s tasks',
    (select count(*) from tasks where student_id = pg_temp.sub('{SB}')::uuid and source = 'platform') = 0
    and (select count(*) from tasks where student_id = pg_temp.sub('{SC}')::uuid and source = 'platform') = 0);
  v := pg_temp.t_val('service_role', null, format($$select automation_upsert_task(%L,'rsm','e100','B''s own task',current_date)$$, raw_b));
  perform pg_temp.t_ok('the same platform id for B stays separate from A''s',
    v not like 'ERR:%'
    and (select count(*) from tasks where external_id = 'e100') = 2
    and (select title from tasks where external_id = 'e100' and student_id = pg_temp.sub('{SA}')::uuid) = 'Pull: Algebra set 7 (new title)'
    and (select title from tasks where external_id = 'e100' and student_id = pg_temp.sub('{SB}')::uuid) = 'B''s own task');
  update tasks set done = true, done_at = now(), coins = 3 where external_id = 'e100' and student_id = pg_temp.sub('{SA}')::uuid;
  v := pg_temp.t_val('service_role', null, format($$select automation_upsert_task(%L,'rsm','e100','REWRITTEN',current_date,current_date+9,'x',99,true,null)$$, raw_a));
  perform pg_temp.t_ok('a key cannot rewrite a task she already finished',
    v not like 'ERR:%'
    and (select title from tasks where external_id = 'e100' and student_id = pg_temp.sub('{SA}')::uuid) = 'Pull: Algebra set 7 (new title)'
    and (select due_date from tasks where external_id = 'e100' and student_id = pg_temp.sub('{SA}')::uuid) = current_date + 4
    and (select done from tasks where external_id = 'e100' and student_id = pg_temp.sub('{SA}')::uuid));
  perform pg_temp.t_ok('a key cannot set done-state, coins or box credit (no such parameters) and the ledger is untouched',
    (select count(*) from ledger where student_id = pg_temp.sub('{SA}')::uuid) = 1);
  perform pg_temp.t_ok('a call without a platform id is refused',
    pg_temp.t_val('service_role', null, format($$select automation_upsert_task(%L,'rsm','','x',current_date)$$, raw_a)) like 'ERR:%');
  key_a := (select id from automation_keys where student_id = pg_temp.sub('{SA}')::uuid and name = 'key for A');
  perform pg_temp.t_denied('coach 2 revokes A''s key', ro, pg_temp.sub('{C2}')::uuid, format('select revoke_automation_key(%L)', key_a));
  perform pg_temp.t_denied('student A revokes her own key', ro, pg_temp.sub('{SA}')::uuid, format('select revoke_automation_key(%L)', key_a));
  perform pg_temp.t_allowed('coach 1 revokes A''s key', ro, pg_temp.sub('{C1}')::uuid, format('select revoke_automation_key(%L)', key_a));
  v := pg_temp.t_val('service_role', null, format($$select automation_upsert_task(%L,'rsm','e200','after revoke',current_date)$$, raw_a));
  perform pg_temp.t_ok('a revoked key stops working at once',
    pg_temp.t_val('service_role', null, format($$select coalesce(automation_student_for_key(%L)::text,'nobody')$$, raw_a)) = 'nobody'
    and v = 'ERR:42501'
    and not exists (select 1 from tasks where external_id = 'e200'));
  perform pg_temp.t_ok('key B still works after key A was revoked',
    pg_temp.t_val('service_role', null, format('select automation_student_for_key(%L)', raw_b)) = pg_temp.sub('{SB}'));
  perform pg_temp.t_ok('key use and creation are in the audit log',
    (select count(*) from audit_log where table_name = 'automation_keys') >= 3 and (select count(*) from audit_log where action = 'automation') >= 1);

  ---------------------------------------------------------------------------------------------
  -- 6. PHOTOS
  ---------------------------------------------------------------------------------------------
  perform pg_temp.t_allowed('student A uploads into her own folder', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', '{SA}/{TA1}/photo.jpg')$$);
  perform pg_temp.t_denied('student A uploads into B''s folder', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', '{SB}/{TB1}/photo.jpg')$$);
  perform pg_temp.t_denied('student A uploads to the top level', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', 'photo.jpg')$$);
  perform pg_temp.t_denied('student A uploads into a path that only starts like her folder', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', '{SA}x/photo.jpg')$$);
  perform pg_temp.t_denied('student A uploads into another bucket', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('other-bucket', '{SA}/photo.jpg')$$);
  perform pg_temp.t_denied('a parent uploads into her child''s folder', ro, pg_temp.sub('{PA}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', '{SA}/{TA1}/parent.jpg')$$);
  perform pg_temp.t_denied('a coach uploads into her student''s folder', ro, pg_temp.sub('{C1}')::uuid,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', '{SA}/{TA1}/coach.jpg')$$);
  perform pg_temp.t_denied('the signed-out role uploads', 'anon', null,
    $$insert into storage.objects (bucket_id, name) values ('proof-photos', '{SA}/{TA1}/anon.jpg')$$);
  perform pg_temp.t_ok('the photo is there (checked as the database owner)',
    (select count(*) from storage.objects where bucket_id = 'proof-photos' and name like pg_temp.sub('{SA}') || '/%') = 1);
  perform pg_temp.t_denied('student A lists photos, even her own', ro, pg_temp.sub('{SA}')::uuid, $$select * from storage.objects$$);
  perform pg_temp.t_denied('parent A lists photos', ro, pg_temp.sub('{PA}')::uuid, $$select * from storage.objects$$);
  perform pg_temp.t_denied('coach 1 lists photos', ro, pg_temp.sub('{C1}')::uuid, $$select * from storage.objects$$);
  perform pg_temp.t_denied('student B lists photos', ro, pg_temp.sub('{SB}')::uuid, $$select * from storage.objects$$);
  perform pg_temp.t_denied('the signed-out role lists photos', 'anon', null, $$select * from storage.objects$$);
  perform pg_temp.t_denied('student A replaces her photo', ro, pg_temp.sub('{SA}')::uuid, $$update storage.objects set name = '{SA}/swap.jpg'$$);
  perform pg_temp.t_denied('student A deletes her photo', ro, pg_temp.sub('{SA}')::uuid, $$delete from storage.objects$$);
  perform pg_temp.t_denied('student B moves A''s photo to B''s folder', ro, pg_temp.sub('{SB}')::uuid, $$update storage.objects set name = '{SB}/stolen.jpg'$$);

  ---------------------------------------------------------------------------------------------
  -- 7. THE SERVER STILL WORKS (so the locks above are not locking everything)
  ---------------------------------------------------------------------------------------------
  perform pg_temp.t_allowed('server code can finish a task and set coins', 'service_role', null,
    $$update tasks set done = true, done_at = now(), coins = 4, reward_status = 'provisional' where id = '{TA1}'$$);
  perform pg_temp.t_allowed('server code can write the ledger', 'service_role', null,
    $$insert into ledger (student_id, kind, amount, status, task_id) values ('{SA}', 'earn', 4, 'held', '{TA1}')$$);
  perform pg_temp.t_allowed('server code can record a review', 'service_role', null,
    $$update tasks set review_status = 'looks_good', reviewed_at = now(), reward_status = 'confirmed' where id = '{TA1}'$$);
  perform pg_temp.t_ok('those server changes are in the audit log',
    (select count(*) from audit_log where table_name = 'tasks' and row_id = pg_temp.sub('{TA1}') and action = 'update') >= 2
    and (select count(*) from audit_log where table_name = 'ledger' and student_id = pg_temp.sub('{SA}')::uuid) >= 2);
  perform pg_temp.t_ok('the student now sees her finished task, coins and confirmed status',
    pg_temp.t_val(ro, pg_temp.sub('{SA}')::uuid, $$select (done and coins = 4 and reward_status = 'confirmed')::text from tasks where id = '{TA1}'$$) = 'true');
  perform pg_temp.t_ok('the signed-out role cannot call the helper functions',
    pg_temp.t_val('anon', null, 'select app_role()') = 'ERR:42501' and pg_temp.t_val('anon', null, $$select can_read_student('{SA}')$$) = 'ERR:42501');

  ---------------------------------------------------------------------------------------------
  -- 8. LOGINS (step 3): two-factor for coaches, invites, lockout, reset links, signing out
  ---------------------------------------------------------------------------------------------
  -- A coach who has only typed her password (no authenticator code yet) has no coach powers.
  perform set_config('emma.test_aal', 'aal1', true);
  perform pg_temp.t_ok('coach without the authenticator step has no role',
    pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, 'select coalesce(app_role(), ''none'')') = 'none');
  perform pg_temp.t_denied('coach without the authenticator step reads her student''s tasks', ro, pg_temp.sub('{C1}')::uuid,
    $$select * from tasks where student_id = '{SA}'$$);
  perform pg_temp.t_denied('coach without the authenticator step reads her student''s profile', ro, pg_temp.sub('{C1}')::uuid,
    $$select * from profiles where id = '{SA}'$$);
  perform pg_temp.t_denied('coach without the authenticator step reads her links', ro, pg_temp.sub('{C1}')::uuid,
    $$select * from student_links$$);
  perform pg_temp.t_denied('coach without the authenticator step edits her student''s settings', ro, pg_temp.sub('{C1}')::uuid,
    $$update student_settings set proof_strictness = 'strict' where student_id = '{SA}'$$);
  perform pg_temp.t_denied('coach without the authenticator step reads the audit log', ro, pg_temp.sub('{C1}')::uuid,
    $$select * from audit_log$$);
  perform pg_temp.t_ok('coach without the authenticator step cannot open the ADHD profile',
    pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, $$select read_adhd_profile('{SA}')::text$$) = 'ERR:42501');
  perform pg_temp.t_allowed('coach without the authenticator step still sees her own profile (so the app can ask for the code)',
    ro, pg_temp.sub('{C1}')::uuid, $$select * from profiles where id = '{C1}'$$);
  perform pg_temp.t_allowed('a student signs in with just a password and reads her tasks', ro, pg_temp.sub('{SA}')::uuid,
    $$select * from tasks where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('a parent signs in with just a password and reads their child''s tasks', ro, pg_temp.sub('{PA}')::uuid,
    $$select * from tasks where student_id = '{SA}'$$);
  perform set_config('emma.test_aal', 'aal2', true);
  perform pg_temp.t_allowed('coach with the authenticator step reads her student''s tasks', ro, pg_temp.sub('{C1}')::uuid,
    $$select * from tasks where student_id = '{SA}'$$);
  perform pg_temp.t_allowed('coach with the authenticator step reads her links', ro, pg_temp.sub('{C1}')::uuid,
    $$select * from student_links$$, 2);

  -- The login tables are closed to everyone in the app, whatever their role.
  foreach t in array array['invites','account_contacts','auth_attempts','reset_tokens'] loop
    perform pg_temp.t_ok('nobody in the app can read ' || t,
      pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, format('select count(*)::text from %I', t)) = 'ERR:42501'
      and pg_temp.t_val(ro, pg_temp.sub('{SA}')::uuid, format('select count(*)::text from %I', t)) = 'ERR:42501'
      and pg_temp.t_val(ro, pg_temp.sub('{PA}')::uuid, format('select count(*)::text from %I', t)) = 'ERR:42501'
      and pg_temp.t_val('anon', null, format('select count(*)::text from %I', t)) = 'ERR:42501');
  end loop;
  perform pg_temp.t_denied('a student writes her own invite', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into invites (code_hash, role, first_name, expires_at) values ('x', 'coach', 'Me', now() + interval '1 day')$$);
  perform pg_temp.t_denied('a coach writes an invite directly', ro, pg_temp.sub('{C1}')::uuid,
    $$insert into invites (code_hash, role, first_name, expires_at) values ('x', 'student', 'Kid', now() + interval '1 day')$$);
  perform pg_temp.t_denied('a student makes her own reset link', ro, pg_temp.sub('{SA}')::uuid,
    $$insert into reset_tokens (user_id, token_hash, expires_at) values ('{SA}', 'x', now() + interval '1 hour')$$);
  perform pg_temp.t_denied('a parent changes a recovery email', ro, pg_temp.sub('{PA}')::uuid,
    $$insert into account_contacts (user_id, recovery_email) values ('{SA}', 'me@example.com')$$);
  perform pg_temp.t_denied('someone clears their failed sign-ins', ro, pg_temp.sub('{SA}')::uuid, $$delete from auth_attempts$$);

  -- The login functions can only be called by server code.
  foreach t in array array[
      $$select account_invite_create('{C1}', 'student', 'Kid', null, 'h1', 7)::text$$,
      $$select account_invite_peek('h1')::text$$,
      $$select account_invite_finish('h1', '{SA}', 'kid', 'a@b.co')::text$$,
      $$select account_invite_list('{C1}')::text$$,
      $$select account_invite_cancel('{C1}', '{SA}')::text$$,
      $$select auth_attempt_blocked('sign_in', 'studenta', null)::text$$,
      $$select auth_attempt_record('sign_in', 'studenta', null, true)::text$$,
      $$select account_login_email('studenta')$$,
      $$select account_reset_create(null, '{SA}', 'h2')::text$$,
      $$select account_reset_use('h2')::text$$,
      $$select account_end_sessions(null, '{SA}')::text$$,
      $$select account_can_manage('{SA}', '{SB}')::text$$] loop
    perform pg_temp.t_ok('app logins cannot call: ' || left(t, 40),
      pg_temp.t_val(ro, pg_temp.sub('{C1}')::uuid, t) = 'ERR:42501'
      and pg_temp.t_val(ro, pg_temp.sub('{SA}')::uuid, t) = 'ERR:42501'
      and pg_temp.t_val('anon', null, t) = 'ERR:42501');
  end loop;

  -- Who may make an invite (server code acting for someone).
  perform pg_temp.t_ok('a coach can invite a student',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{C1}', 'student', 'Newkid', null, 'inv-student', 7)$$) not like 'ERR:%');
  perform pg_temp.t_ok('a coach can invite a parent for her own student',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{C1}', 'parent', 'Newparent', '{SA}', 'inv-parent', 7)$$) not like 'ERR:%');
  perform pg_temp.t_ok('a coach cannot invite a parent for another coach''s student',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{C1}', 'parent', 'Sneaky', '{SC}', 'inv-x1', 7)$$) = 'ERR:42501');
  perform pg_temp.t_ok('a student cannot make an invite',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{SA}', 'student', 'Friend', null, 'inv-x2', 7)$$) = 'ERR:42501');
  perform pg_temp.t_ok('a parent cannot make an invite',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{PA}', 'parent', 'Other', '{SA}', 'inv-x3', 7)$$) = 'ERR:42501');
  perform pg_temp.t_ok('a coach cannot invite another coach',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{C1}', 'coach', 'Coach3', null, 'inv-x4', 7)$$) = 'ERR:42501');
  perform pg_temp.t_ok('the developer script can only make coach invites',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create(null, 'student', 'Kid', null, 'inv-x5', 7)$$) = 'ERR:42501'
    and pg_temp.t_val('service_role', null, $$select id::text from account_invite_create(null, 'coach', 'Coach3', null, 'inv-coach', 7)$$) not like 'ERR:%');
  perform pg_temp.t_ok('an invite cannot last more than 14 days',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{C1}', 'student', 'Kid', null, 'inv-x6', 30)$$) like 'ERR:%');
  perform pg_temp.t_ok('an invite stores only the code''s hash, and making one is logged',
    (select count(*) from invites where code_hash = 'inv-student') = 1
    and (select count(*) from audit_log where action = 'invite_create' and actor_id = pg_temp.sub('{C1}')::uuid) >= 2);
  perform pg_temp.t_ok('the coach sees her waiting invites, not other coaches''',
    pg_temp.t_val('service_role', null, $$select count(*)::text from account_invite_list('{C1}')$$) = '2'
    and pg_temp.t_val('service_role', null, $$select count(*)::text from account_invite_list('{C2}')$$) = '0');

  -- Using an invite.
  insert into auth.users (id, email) values
    ('00000000-0000-4000-8000-0000000000d1', 'd1@test.invalid'), ('00000000-0000-4000-8000-0000000000d2', 'd2@test.invalid'),
    ('00000000-0000-4000-8000-0000000000d3', 'd3@test.invalid'), ('00000000-0000-4000-8000-0000000000d4', 'd4@test.invalid');
  perform pg_temp.t_ok('a valid invite greets the person by first name',
    pg_temp.t_val('service_role', null, $$select first_name from account_invite_peek('inv-student')$$) = 'Newkid');
  perform pg_temp.t_ok('a made-up code finds nothing',
    pg_temp.t_val('service_role', null, $$select count(*)::text from account_invite_peek('not-a-code')$$) = '0');
  perform pg_temp.t_ok('a student uses her invite',
    pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-student', '00000000-0000-4000-8000-0000000000d1', 'newkid', 'Grownup@Example.com')$$) = 'student');
  perform pg_temp.t_ok('the new student has her profile, her coach link and all six starting rows',
    (select role from profiles where id = '00000000-0000-4000-8000-0000000000d1') = 'student'
    and exists (select 1 from student_links where student_id = '00000000-0000-4000-8000-0000000000d1'
                and adult_id = pg_temp.sub('{C1}')::uuid and relation = 'coach')
    and exists (select 1 from student_settings where student_id = '00000000-0000-4000-8000-0000000000d1')
    and exists (select 1 from helper_settings where student_id = '00000000-0000-4000-8000-0000000000d1')
    and exists (select 1 from tutor_settings where student_id = '00000000-0000-4000-8000-0000000000d1')
    and exists (select 1 from prize_settings where student_id = '00000000-0000-4000-8000-0000000000d1')
    and exists (select 1 from reward_packs where student_id = '00000000-0000-4000-8000-0000000000d1')
    and exists (select 1 from themes where student_id = '00000000-0000-4000-8000-0000000000d1'));
  perform pg_temp.t_ok('her recovery email is saved in lower case',
    (select recovery_email from account_contacts where user_id = '00000000-0000-4000-8000-0000000000d1') = 'grownup@example.com');
  perform pg_temp.t_ok('the new student starts with chat and tutor off, and no consent recorded',
    (select not chat_on and not chat_consent from helper_settings where student_id = '00000000-0000-4000-8000-0000000000d1')
    and (select not consent_given from tutor_settings where student_id = '00000000-0000-4000-8000-0000000000d1'));
  perform pg_temp.t_ok('an invite works only once',
    pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-student', '00000000-0000-4000-8000-0000000000d2', 'second', 'x@example.com')$$) like 'ERR:%'
    and pg_temp.t_val('service_role', null, $$select count(*)::text from account_invite_peek('inv-student')$$) = '0');
  perform pg_temp.t_ok('a taken username is refused',
    pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-coach', '00000000-0000-4000-8000-0000000000d2', 'newkid', 'x@example.com')$$) like 'ERR:%');
  perform pg_temp.t_ok('a bad recovery email is refused',
    pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-coach', '00000000-0000-4000-8000-0000000000d2', 'coachthree', 'not an email')$$) like 'ERR:%');
  perform pg_temp.t_ok('the coach invite was not used up by those failed tries',
    pg_temp.t_val('service_role', null, $$select count(*)::text from account_invite_peek('inv-coach')$$) = '1');
  v := pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-parent', '00000000-0000-4000-8000-0000000000d2', 'newparent', 'p@example.com')$$);
  perform pg_temp.t_ok('a parent uses their invite and is linked to the right child only',
    v = 'parent'
    and (select count(*) from student_links where adult_id = '00000000-0000-4000-8000-0000000000d2') = 1
    and exists (select 1 from student_links where adult_id = '00000000-0000-4000-8000-0000000000d2'
                and student_id = pg_temp.sub('{SA}')::uuid and relation = 'parent'), 'result=' || coalesce(v, 'null'));
  perform pg_temp.t_allowed('the new parent reads their child''s tasks', ro, '00000000-0000-4000-8000-0000000000d2',
    $$select * from tasks where student_id = '{SA}'$$);
  perform pg_temp.t_denied('the new parent cannot read another child''s tasks', ro, '00000000-0000-4000-8000-0000000000d2',
    $$select * from tasks where student_id = '{SB}'$$);
  perform pg_temp.t_ok('using an invite is logged',
    (select count(*) from audit_log where action = 'invite_used') >= 2);

  -- Expired and cancelled invites.
  insert into invites (code_hash, role, first_name, created_by, expires_at)
  values ('inv-old', 'student', 'Late', pg_temp.sub('{C1}')::uuid, now() - interval '1 minute');
  perform pg_temp.t_ok('an expired invite cannot be used',
    pg_temp.t_val('service_role', null, $$select count(*)::text from account_invite_peek('inv-old')$$) = '0'
    and pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-old', '00000000-0000-4000-8000-0000000000d3', 'late', 'l@example.com')$$) like 'ERR:%');
  perform pg_temp.t_ok('a coach cannot cancel another coach''s invite',
    pg_temp.t_val('service_role', null, $$select account_invite_cancel('{C2}', (select id from invites where code_hash = 'inv-coach'))::text$$) = 'false');
  perform pg_temp.t_ok('the developer''s coach invite cannot be cancelled by an app coach either',
    pg_temp.t_val('service_role', null, $$select account_invite_cancel('{C1}', (select id from invites where code_hash = 'inv-coach'))::text$$) = 'false');
  perform pg_temp.t_ok('a coach makes and cancels an invite, and then it cannot be used',
    pg_temp.t_val('service_role', null, $$select id::text from account_invite_create('{C1}', 'student', 'Maybe', null, 'inv-cancel', 7)$$) not like 'ERR:%'
    and pg_temp.t_val('service_role', null, $$select account_invite_cancel('{C1}', (select id from invites where code_hash = 'inv-cancel'))::text$$) = 'true'
    and pg_temp.t_val('service_role', null, $$select role from account_invite_finish('inv-cancel', '00000000-0000-4000-8000-0000000000d3', 'maybe', 'm@example.com')$$) like 'ERR:%');
  perform pg_temp.t_ok('the hidden sign-in address is found by username (server only)',
    pg_temp.t_val('service_role', null, $$select account_login_email('newkid')$$) = 'd1@test.invalid'
    and pg_temp.t_val('service_role', null, $$select coalesce(account_login_email('nobody_here'), 'none')$$) = 'none');

  -- Lockout after 5 wrong passwords.
  insert into auth_attempts (kind, key, ip, ok, at)
  select 'sign_in', 'newkid', '10.0.0.1', false, now() - interval '2 minutes' from generate_series(1, 4);
  perform pg_temp.t_ok('4 wrong passwords do not lock the username',
    pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('sign_in', 'newkid', '10.0.0.1')::text$$) = 'false');
  perform pg_temp.t_val('service_role', null, $$select auth_attempt_record('sign_in', 'newkid', '10.0.0.1', false)::text$$);
  perform pg_temp.t_ok('the 5th wrong password locks it',
    pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('sign_in', 'newkid', '10.0.0.2')::text$$) = 'true');
  perform pg_temp.t_ok('a username that does not exist locks the same way (so the lock does not reveal who exists)',
    (select count(*) from (select pg_temp.t_val('service_role', null, $$select auth_attempt_record('sign_in', 'ghost', null, false)::text$$) from generate_series(1, 5)) x) = 5
    and pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('sign_in', 'ghost', null)::text$$) = 'true');
  perform pg_temp.t_ok('the lock is only for that username',
    pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('sign_in', 'studenta', null)::text$$) = 'false');
  insert into auth_attempts (kind, key, ok, at) values
    ('sign_in', 'studentb', false, now() - interval '20 minutes'), ('sign_in', 'studentb', false, now() - interval '20 minutes'),
    ('sign_in', 'studentb', false, now() - interval '20 minutes'), ('sign_in', 'studentb', false, now() - interval '20 minutes'),
    ('sign_in', 'studentb', false, now() - interval '20 minutes');
  perform pg_temp.t_ok('the lock lifts after 15 minutes',
    pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('sign_in', 'studentb', null)::text$$) = 'false');
  insert into auth_attempts (kind, key, ok, at)
  select 'sign_in', 'studentc', false, now() - interval '5 minutes' from generate_series(1, 5);
  insert into auth_attempts (kind, key, ok, at) values ('sign_in', 'studentc', true, now() - interval '1 minute');
  perform pg_temp.t_ok('a good sign-in clears earlier wrong tries',
    pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('sign_in', 'studentc', null)::text$$) = 'false');
  insert into auth_attempts (kind, key, ip, ok)
  select 'invite', '-', '10.9.9.9', false from generate_series(1, 20);
  perform pg_temp.t_ok('20 wrong invite codes from one address pause that address only',
    pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('invite', '-', '10.9.9.9')::text$$) = 'true'
    and pg_temp.t_val('service_role', null, $$select auth_attempt_blocked('invite', '-', '10.9.9.8')::text$$) = 'false');

  -- Reset links.
  perform pg_temp.t_ok('who may send a reset: the student''s coach, her parent, herself',
    pg_temp.t_val('service_role', null, $$select account_can_manage('{C1}', '{SA}')::text$$) = 'true'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{PA}', '{SA}')::text$$) = 'true'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{SA}', '{SA}')::text$$) = 'true'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{C1}', '{PA}')::text$$) = 'true');
  perform pg_temp.t_ok('who may not: another coach, another parent, another student, a child for her parent',
    pg_temp.t_val('service_role', null, $$select account_can_manage('{C2}', '{SA}')::text$$) = 'false'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{PB}', '{SA}')::text$$) = 'false'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{SB}', '{SA}')::text$$) = 'false'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{SA}', '{PA}')::text$$) = 'false'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{PA}', '{C1}')::text$$) = 'false'
    and pg_temp.t_val('service_role', null, $$select account_can_manage('{C2}', '{PA}')::text$$) = 'false');
  perform pg_temp.t_ok('a reset for someone you do not look after is refused',
    pg_temp.t_val('service_role', null, $$select recovery_email from account_reset_create('{C2}', '00000000-0000-4000-8000-0000000000d1', 'rst-x')$$) = 'ERR:42501');
  perform pg_temp.t_ok('a reset for an account with no recovery email is refused',
    pg_temp.t_val('service_role', null, $$select recovery_email from account_reset_create('{C1}', '{SA}', 'rst-y')$$) like 'ERR:%');
  perform pg_temp.t_ok('a reset goes to the saved recovery email',
    pg_temp.t_val('service_role', null, $$select recovery_email from account_reset_create('{C1}', '00000000-0000-4000-8000-0000000000d1', 'rst-1')$$) = 'grownup@example.com');
  perform pg_temp.t_ok('a newer reset link replaces the older one',
    pg_temp.t_val('service_role', null, $$select recovery_email from account_reset_create(null, '00000000-0000-4000-8000-0000000000d1', 'rst-2')$$) = 'grownup@example.com'
    and pg_temp.t_val('service_role', null, $$select coalesce(account_reset_use('rst-1')::text, 'none')$$) = 'none');
  perform pg_temp.t_ok('a reset link works once',
    pg_temp.t_val('service_role', null, $$select account_reset_use('rst-2')::text$$) = '00000000-0000-4000-8000-0000000000d1'
    and pg_temp.t_val('service_role', null, $$select coalesce(account_reset_use('rst-2')::text, 'none')$$) = 'none');
  perform pg_temp.t_ok('a made-up reset link does nothing',
    pg_temp.t_val('service_role', null, $$select coalesce(account_reset_use('rst-made-up')::text, 'none')$$) = 'none');
  perform pg_temp.t_ok('at most 3 reset emails per account per hour',
    pg_temp.t_val('service_role', null, $$select recovery_email from account_reset_create('{C1}', '00000000-0000-4000-8000-0000000000d1', 'rst-3')$$) = 'grownup@example.com'
    and pg_temp.t_val('service_role', null, $$select recovery_email from account_reset_create('{C1}', '00000000-0000-4000-8000-0000000000d1', 'rst-4')$$) like 'ERR:%');
  insert into account_contacts (user_id, recovery_email) values ('00000000-0000-4000-8000-0000000000d2', 'p@example.com')
    on conflict (user_id) do nothing;
  insert into reset_tokens (user_id, token_hash, expires_at, created_at)
  values ('00000000-0000-4000-8000-0000000000d2', 'rst-old', now() - interval '1 minute', now() - interval '2 hours');
  perform pg_temp.t_ok('an expired reset link does nothing',
    pg_temp.t_val('service_role', null, $$select coalesce(account_reset_use('rst-old')::text, 'none')$$) = 'none');
  perform pg_temp.t_ok('reset requests and uses are logged',
    (select count(*) from audit_log where action = 'reset_requested') >= 3 and (select count(*) from audit_log where action = 'reset_used') >= 1);

  -- Signing out of every device.
  insert into auth.sessions (id, user_id) values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000d1'),
    (gen_random_uuid(), '00000000-0000-4000-8000-0000000000d1'), (gen_random_uuid(), pg_temp.sub('{SA}')::uuid);
  perform pg_temp.t_ok('another coach cannot sign a student out',
    pg_temp.t_val('service_role', null, $$select account_end_sessions('{C2}', '00000000-0000-4000-8000-0000000000d1')::text$$) = 'ERR:42501'
    and (select count(*) from auth.sessions where user_id = '00000000-0000-4000-8000-0000000000d1') = 2);
  perform pg_temp.t_val('service_role', null, $$select account_end_sessions('{C1}', '00000000-0000-4000-8000-0000000000d1')::text$$);
  perform pg_temp.t_ok('her coach signs her out of every device, and nobody else is signed out',
    (select count(*) from auth.sessions where user_id = '00000000-0000-4000-8000-0000000000d1') = 0
    and (select count(*) from auth.sessions where user_id = pg_temp.sub('{SA}')::uuid) = 1
    and (select count(*) from audit_log where action = 'sign_out_everywhere') = 1);

  ---------------------------------------------------------------------------------------------
  -- REPORT (always ends by raising, which rolls everything back)
  ---------------------------------------------------------------------------------------------
  select count(*) filter (where ok), count(*) filter (where not ok) into pass, fail from t_results;
  select string_agg(case when ok then 'pass  ' else 'FAIL  ' end || name || case when ok then '' else '   <-- ' || coalesce(detail, '') end, E'\n' order by (case when ok then 1 else 0 end), t_results.n)
    into report from t_results;
  raise exception E'EMMA_RLS_TESTS result=% passed=% failed=%\n%', case when fail = 0 then 'PASS' else 'FAIL' end, pass, fail, report;
end
$test$;
