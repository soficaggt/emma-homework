// Builds the SQL that writes the mapped rows. All of it runs as server code (the database owner), the
// same way the reward functions will, because a student or parent login is not allowed to write
// coins, done-state, boxes or the ledger (house rule 4).
import { sqlJson } from './util.mjs';

const ID_KINDS = ['tasks', 'template_items', 'ledger', 'collection', 'day_results', 'proof_images', 'prize_orders'];

// pg_temp functions disappear when the connection closes; nothing is left in the database.
export const FUNCTIONS = String.raw`
create function pg_temp.legacy_import(sid uuid, d jsonb) returns jsonb language plpgsql as $f$
declare
  prev jsonb; cur jsonb := '{}'::jsonb; k text; stray bigint; removed jsonb := '{}'::jsonb; n bigint;
  kinds text[] := array['tasks','template_items','ledger','collection','day_results','proof_images','prize_orders'];
begin
  if not exists (select 1 from public.profiles where id = sid and role = 'student') then
    raise exception 'IMPORT_STOP: % is not a student account', sid;
  end if;
  foreach k in array kinds loop
    cur := cur || jsonb_build_object(k, (select coalesce(jsonb_agg(x->>'id'), '[]'::jsonb) from jsonb_array_elements(d->k) x));
  end loop;
  -- What the last import for her wrote (kept in the audit log, so a re-run knows its own rows).
  select a.details->'ids' into prev from public.audit_log a
   where a.action = 'legacy_import' and a.student_id = sid order by a.at desc, a.id desc limit 1;
  prev := coalesce(prev, '{}'::jsonb);

  -- Safety stop: if anything exists for her that an earlier import did not write, the new app has been
  -- used, and a re-run could overwrite real new work. Then nothing is changed.
  select (select count(*) from public.tasks t where t.student_id = sid and not coalesce(prev->'tasks', '[]') ? t.id::text)
       + (select count(*) from public.ledger t where t.student_id = sid and not coalesce(prev->'ledger', '[]') ? t.id::text)
       + (select count(*) from public.collection t where t.student_id = sid and not coalesce(prev->'collection', '[]') ? t.id::text)
       + (select count(*) from public.day_results t where t.student_id = sid and not coalesce(prev->'day_results', '[]') ? t.id::text)
       + (select count(*) from public.proof_images t where t.student_id = sid and not coalesce(prev->'proof_images', '[]') ? t.id::text)
       + (select count(*) from public.prize_orders t where t.student_id = sid and not coalesce(prev->'prize_orders', '[]') ? t.id::text)
       + (select count(*) from public.work_sessions t where t.student_id = sid)
    into stray;
  if stray > 0 then
    raise exception 'IMPORT_STOP: % row(s) for this student were not made by an earlier import (the new app has been used). Nothing was changed.', stray;
  end if;

  -- Rows an earlier import made that are no longer in the Sheet are removed (children first).
  foreach k in array array['ledger','proof_images','collection','day_results','prize_orders','tasks','template_items'] loop
    execute format('delete from public.%I t where t.student_id = $1 and $2 ? t.id::text and not $3 ? t.id::text', k)
      using sid, coalesce(prev->k, '[]'::jsonb), cur->k;
    get diagnostics n = row_count;
    removed := removed || jsonb_build_object(k, n);
  end loop;

  insert into public.tasks (id, student_id, date, title, note, minutes, type, color_step, sort_order, done, done_at,
      proof_note, proof_photo_path, due_date, not_today, coins, deleted, source, source_platform, external_id,
      value_set_by, reward_status, confirmed_at, final_at)
  select x.id, sid, x.date, x.title, x.note, x.minutes, x.type, x.color_step, x.sort_order, x.done, x.done_at,
      x.proof_note, x.proof_photo_path, x.due_date, x.not_today, x.coins, x.deleted, x.source, x.source_platform, x.external_id,
      x.value_set_by, x.reward_status, x.confirmed_at, x.final_at
  from jsonb_to_recordset(d->'tasks') as x(id uuid, date date, title text, note text, minutes int, type text, color_step int,
      sort_order int, done boolean, done_at timestamptz, proof_note text, proof_photo_path text, due_date date, not_today boolean,
      coins int, deleted boolean, source text, source_platform text, external_id text, value_set_by text, reward_status text,
      confirmed_at timestamptz, final_at timestamptz)
  on conflict (id) do update set date = excluded.date, title = excluded.title, note = excluded.note, minutes = excluded.minutes,
      type = excluded.type, color_step = excluded.color_step, sort_order = excluded.sort_order, done = excluded.done,
      done_at = excluded.done_at, proof_note = excluded.proof_note, proof_photo_path = excluded.proof_photo_path,
      due_date = excluded.due_date, not_today = excluded.not_today, coins = excluded.coins, deleted = excluded.deleted,
      source = excluded.source, value_set_by = excluded.value_set_by, reward_status = excluded.reward_status,
      confirmed_at = excluded.confirmed_at, final_at = excluded.final_at;

  insert into public.template_items (id, student_id, weekdays, title, note, minutes, type, color_step, sort_order, due_in_days, active)
  select x.id, sid, x.weekdays, x.title, x.note, x.minutes, x.type, x.color_step, x.sort_order, x.due_in_days, x.active
  from jsonb_to_recordset(d->'template_items') as x(id uuid, weekdays int[], title text, note text, minutes int, type text,
      color_step int, sort_order int, due_in_days int, active boolean)
  on conflict (id) do update set weekdays = excluded.weekdays, title = excluded.title, note = excluded.note, minutes = excluded.minutes,
      type = excluded.type, sort_order = excluded.sort_order, due_in_days = excluded.due_in_days, active = excluded.active;

  insert into public.ledger (id, student_id, kind, amount, status, task_id, note, created_at, confirmed_at)
  select x.id, sid, x.kind, x.amount, x.status, x.task_id, x.note, x.created_at, x.confirmed_at
  from jsonb_to_recordset(d->'ledger') as x(id uuid, kind text, amount int, status text, task_id uuid, note text,
      created_at timestamptz, confirmed_at timestamptz)
  on conflict (id) do update set kind = excluded.kind, amount = excluded.amount, status = excluded.status, task_id = excluded.task_id,
      note = excluded.note, created_at = excluded.created_at, confirmed_at = excluded.confirmed_at;

  insert into public.collection (id, student_id, item_id, item_name, rarity, acquired_via, box_date, shelf_pos, acquired_at)
  select x.id, sid, x.item_id, x.item_name, x.rarity, x.acquired_via, x.box_date, x.shelf_pos, x.acquired_at
  from jsonb_to_recordset(d->'collection') as x(id uuid, item_id text, item_name text, rarity text, acquired_via text,
      box_date date, shelf_pos int, acquired_at timestamptz)
  on conflict (id) do update set item_id = excluded.item_id, item_name = excluded.item_name, rarity = excluded.rarity,
      acquired_via = excluded.acquired_via, box_date = excluded.box_date, shelf_pos = excluded.shelf_pos, acquired_at = excluded.acquired_at;

  insert into public.day_results (id, student_id, date, box_earned, box_kind, sparkle, opened, opened_at, box_item_id)
  select x.id, sid, x.date, x.box_earned, x.box_kind, x.sparkle, x.opened, x.opened_at, x.box_item_id
  from jsonb_to_recordset(d->'day_results') as x(id uuid, date date, box_earned boolean, box_kind text, sparkle boolean,
      opened boolean, opened_at timestamptz, box_item_id text)
  on conflict (id) do update set box_earned = excluded.box_earned, box_kind = excluded.box_kind, sparkle = excluded.sparkle,
      opened = excluded.opened, opened_at = excluded.opened_at, box_item_id = excluded.box_item_id;

  insert into public.proof_images (id, task_id, student_id, storage_path, sha256, phash, origin, taken_at, created_at)
  select x.id, x.task_id, sid, x.storage_path, x.sha256, x.phash, x.origin, x.taken_at, x.created_at
  from jsonb_to_recordset(d->'proof_images') as x(id uuid, task_id uuid, storage_path text, sha256 text, phash text,
      origin text, taken_at timestamptz, created_at timestamptz)
  on conflict (id) do update set task_id = excluded.task_id, storage_path = excluded.storage_path, sha256 = excluded.sha256,
      created_at = excluded.created_at;

  insert into public.prize_orders (id, student_id, week_start, item_name, price_cents, status)
  select x.id, sid, x.week_start, x.item_name, x.price_cents, x.status
  from jsonb_to_recordset(d->'prize_orders') as x(id uuid, week_start date, item_name text, price_cents int, status text)
  on conflict (id) do update set week_start = excluded.week_start, item_name = excluded.item_name,
      price_cents = excluded.price_cents, status = excluded.status;

  insert into public.student_settings (student_id, no_proof_types, no_alert_types)
  select sid, x.no_proof_types, x.no_alert_types
  from jsonb_to_recordset(d->'student_settings') as x(no_proof_types text[], no_alert_types text[])
  on conflict (student_id) do update set no_proof_types = excluded.no_proof_types, no_alert_types = excluded.no_alert_types;

  insert into public.audit_log (actor_id, action, table_name, row_id, student_id, details)
  values (null, 'legacy_import', null, null, sid, jsonb_build_object('ids', cur, 'source', 'old Google Sheet', 'removed', removed));

  return jsonb_build_object('written', (select jsonb_object_agg(k2, jsonb_array_length(cur->k2)) from unnest(kinds) k2), 'removed', removed);
end $f$;

-- The numbers the new database now shows for her, for the comparison with the old site.
create function pg_temp.import_numbers(sid uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'coins_spendable',  (select coalesce(sum(amount), 0) from public.ledger where student_id = sid and status = 'confirmed'),
    'coins_held',       (select coalesce(sum(amount), 0) from public.ledger where student_id = sid and status = 'held'),
    'ledger_rows_not_confirmed', (select count(*) from public.ledger where student_id = sid and status <> 'confirmed'),
    'coins_earned',     (select coalesce(sum(amount), 0) from public.ledger where student_id = sid and kind in ('earn','egg')),
    'coins_spent',      (select coalesce(sum(amount), 0) from public.ledger where student_id = sid and kind in ('purchase','ticket')),
    -- Any coins not tied to a finished task or a purchase (a box paying coins would show up here).
    'ledger_box_rows',  (select count(*) from public.ledger where student_id = sid
                           and (kind not in ('earn','egg','purchase','ticket','forgiven') or (kind in ('earn','egg') and task_id is null))),
    'tasks',            (select count(*) from public.tasks where student_id = sid),
    'tasks_not_deleted',(select count(*) from public.tasks where student_id = sid and not deleted),
    'done_tasks',       (select count(*) from public.tasks where student_id = sid and done and not deleted),
    'done_not_confirmed', (select count(*) from public.tasks where student_id = sid and done and reward_status <> 'confirmed'),
    'review_window_open', (select count(*) from public.tasks where student_id = sid and done and (final_at is null or final_at > now())),
    'done_coins_without_ledger', (select count(*) from public.tasks t where t.student_id = sid and t.done and not t.deleted and t.coins > 0
                                    and not exists (select 1 from public.ledger l where l.task_id = t.id and l.kind = 'earn')),
    'shelf_items',      (select count(*) from public.collection where student_id = sid),
    'shelf_items_not_in_catalog', (select count(*) from public.collection c where c.student_id = sid
                                    and not exists (select 1 from public.reward_catalog r where r.id = c.item_id)),
    'boxes_opened',     (select count(*) from public.day_results where student_id = sid and opened),
    'boxes_waiting',    (select count(*) from public.day_results where student_id = sid and box_earned and not opened),
    'full_boxes',       (select count(*) from public.day_results where student_id = sid and box_kind = 'full'),
    'mini_boxes',       (select count(*) from public.day_results where student_id = sid and box_kind = 'mini'),
    'sparkle_boxes',    (select count(*) from public.day_results where student_id = sid and sparkle),
    'photos',           (select count(*) from public.proof_images where student_id = sid),
    'tasks_with_photo', (select count(*) from public.tasks where student_id = sid and proof_photo_path is not null),
    'photo_paths_outside_her_folder', (select count(*) from public.proof_images where student_id = sid
                                    and split_part(storage_path, '/', 1) <> sid::text),
    'real_picks_recorded', (select count(*) from public.prize_orders where student_id = sid),
    'template_items',   (select count(*) from public.template_items where student_id = sid),
    'template_day_slots', (select coalesce(sum(cardinality(weekdays)), 0) from public.template_items where student_id = sid)
  )
$f$;
`;

export function idSets(rows) {
  const o = {};
  for (const k of ID_KINDS) o[k] = rows[k].map(r => r.id);
  return o;
}

// The dry run: a made-up student, the import run twice from two separate mappings (to prove a re-run
// updates instead of copying),
// then a check that the safety stop works, then everything is thrown away. The block always ends by
// raising an error that carries the report, which makes Postgres roll the whole thing back.
export function dryRunSql(fakeStudentId, rows, rowsAgain) {
  return `${FUNCTIONS}
do $dry$
declare sid uuid := '${fakeStudentId}'; d jsonb := ${sqlJson(rows)}; d2 jsonb := ${sqlJson(rowsAgain)};
  r1 jsonb; r2 jsonb; n1 jsonb; n2 jsonb; guard text; as_student text;
begin
  insert into auth.users (id, email) values (sid, 'legacy-import-dry-run@example.invalid');
  insert into public.profiles (id, role, first_name) values (sid, 'student', 'Dryrun');
  r1 := pg_temp.legacy_import(sid, d);  n1 := pg_temp.import_numbers(sid);
  r2 := pg_temp.legacy_import(sid, d2); n2 := pg_temp.import_numbers(sid);   -- mapped again from scratch, as a real re-run would be
  -- The fake student signs in and tries to hand herself coins: must be refused.
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', sid::text, true);
  begin
    set local role authenticated;
    insert into public.ledger (student_id, kind, amount, status) values (sid, 'earn', 50, 'confirmed');
    as_student := 'NOT REFUSED';
  exception when others then as_student := 'refused (' || sqlstate || ')';
  end;
  reset role;
  -- Pretend the new app has been used, then re-run: it must stop and change nothing.
  insert into public.tasks (student_id, date, title) values (sid, current_date, 'A task made in the new app');
  begin
    perform pg_temp.legacy_import(sid, d);
    guard := 'NOT STOPPED';
  exception when others then guard := sqlerrm;
  end;
  raise exception 'EMMA_IMPORT_DRYRUN %', jsonb_build_object('first_run', r1, 'second_run', r2, 'numbers', n1,
    'rerun_changed_numbers', n1 <> n2, 'rerun_guard', guard, 'student_writes_ledger', as_student,
    'audit_rows', (select count(*) from public.audit_log where student_id = sid and action = 'legacy_import'),
    'rows_after_rerun', (select count(*) from public.tasks where student_id = sid) + (select count(*) from public.ledger where student_id = sid)
      + (select count(*) from public.collection where student_id = sid) + (select count(*) from public.day_results where student_id = sid)
      + (select count(*) from public.template_items where student_id = sid) + (select count(*) from public.proof_images where student_id = sid))::text;
end $dry$;
`;
}

// The real import. Not run in step 10: it needs Emma's account (step 3) and Sofia's go-ahead.
export function realSql(studentId, rows) {
  return `${FUNCTIONS}
create temp table legacy_import_out (summary jsonb, numbers jsonb);
begin;
do $real$
begin
  insert into legacy_import_out
  select s, pg_temp.import_numbers('${studentId}') from (select pg_temp.legacy_import('${studentId}', ${sqlJson(rows)}) s) q;
end $real$;
commit;
select jsonb_build_object('summary', summary, 'numbers', numbers)::text as result from legacy_import_out;
`;
}
