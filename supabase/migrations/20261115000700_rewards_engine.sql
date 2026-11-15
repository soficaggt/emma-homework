-- Step 7: the rewards engine (PRD 3a, 6c, 6f). Decided with Sofia on Nov 15:
--   * coins come from a fixed priority level, never from a theme's colors:
--     must do 3, high 2, normal 1.5, low 1, optional 1, dinner 1, waiting for an adult 0; the egg is +1
--   * shop prices: common 18, uncommon 32 (30% below the old 25 and 45); shop size 12; no daily caps
--   * skill coins: +1 each, once per real thing (per task, per night, per project)
--   * sparkle box: full boxes on 3 of her last 4 homework days; the weekly real prize allows one missed homework day;
--     days with no homework are skipped
--   * a Not done is a strike that only adults see; 3 strikes in 14 days turn on a 7-day check mode
-- Everything that pays, confirms, reverses or opens is a SECURITY DEFINER function that checks who is calling.
-- Nothing here gives the app new write rights on any table.

---------------------------------------------------------------------------------------------------
-- 1. COLUMNS
---------------------------------------------------------------------------------------------------
-- Coins can be halves (normal is 1.5).
alter table public.tasks alter column coins type numeric(3,1);
alter table public.tasks add constraint tasks_coins_halves check (coins * 2 = trunc(coins * 2));
alter table public.ledger alter column amount type numeric(7,1);
alter table public.ledger add constraint ledger_amount_halves check (amount * 2 = trunc(amount * 2));

alter table public.tasks
  add column value_level      text check (value_level in ('must','high','normal','low','optional','dinner','waiting')),
  add column pays_again       boolean not null default true,     -- false after a reopen where spent coins or an opened box were forgiven
  add column reopened_at      timestamptz,                        -- last time an adult (or her own uncheck) reopened it
  add column reminder_sent_at timestamptz;                        -- the "waiting for a look" reminder went to the adults

alter table public.ledger drop constraint ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('earn','egg','skill','purchase','ticket','gift','reversal','forgiven'));

alter table public.day_results
  add column earned_at         timestamptz,
  add column gift              boolean not null default false,
  add column gift_note         text,
  add column counted_task_ids  uuid[] not null default '{}';       -- the finished tasks that counted when the box was opened

alter table public.skill_events
  add column ref    text,                                          -- what it was for: a task, a night, a project
  add column coins  numeric(3,1) not null default 0;
create unique index skill_events_once on public.skill_events (student_id, kind, ref) where ref is not null;

alter table public.catalog_items
  add column category   text,                                      -- the pack's own shelves ("shelf", "slime" for Emma)
  add column legacy_id  text;                                      -- the old Code.gs id, for items copied from reward_catalog
create unique index catalog_items_legacy on public.catalog_items (student_id, legacy_id) where legacy_id is not null;

alter table public.student_settings
  add column check_mode_started_at timestamptz,
  add column check_mode_until      timestamptz;

alter table public.integrity_flags drop constraint integrity_flags_kind_check;
alter table public.integrity_flags add constraint integrity_flags_kind_check
  check (kind in ('implausible_title','too_fast','duplicate','reused_text','reused_photo','many_self_added',
                  'not_done','rewards_forgiven','box_pool_empty','other'));

---------------------------------------------------------------------------------------------------
-- 2. THE SHARED ECONOMY (one set for every student; only a developer changes it, by migration)
---------------------------------------------------------------------------------------------------
update public.economy_config set
  value = '{"levels":{"must":3,"high":2,"normal":1.5,"low":1,"optional":1,"dinner":1,"waiting":0},"min":0,"max":6}',
  note  = 'Per finished task, by priority level. A theme''s colors never set coins. Decided Nov 15'
 where key = 'task_coins';
update public.economy_config set
  value = '{"prices":{"common":18,"uncommon":32},"size":12,"split":"even across the pack''s categories","refresh_day":"monday","owned_items_hidden":true}',
  note  = 'Only common and uncommon are for sale. Prices cut 30% on Nov 15 (rounded to whole coins)'
 where key = 'shop';
update public.economy_config set
  value = '{"full_box_min_share_checked":0.5,"dinner_excluded":true,"moved_counts_as_not_today":true,"sparkle":{"full_boxes":3,"of_last_homework_days":4},"days_without_homework":"skipped","box_waits_for_confirmed_tasks":true}',
  note  = 'Plans (type fixed) are never checkable. Sparkle softened to 3 of the last 4 homework days on Nov 15'
 where key = 'box_rules';
update public.economy_config set
  value = '{"rule":"a Monday to Sunday week where every day that had homework earned a box","missed_homework_days_allowed":1,"rewards_must_be_confirmed":true}',
  note  = 'One missed homework day allowed (Nov 15)'
 where key = 'real_pick';
insert into public.economy_config (key, value, note) values
  ('skill_coins', '{"starting":1,"writing_down":1,"packing":1,"planning":1,"starting_min_minutes":5}',
   'Once per real thing: per task (starting, writing it down, a start plan), per night (packing), per project (plan approved). No daily caps'),
  ('strikes', '{"window_days":14,"count":3,"check_mode_days":7}',
   'A Not done is a strike adults see and the student does not. 3 in 14 days turn on check mode for 7 days'),
  ('gifts', '{"coins_min":0.5,"coins_max":50}', 'A coach gives coins or a box by hand, always logged');

---------------------------------------------------------------------------------------------------
-- 3. SMALL HELPERS (not callable from the app)
---------------------------------------------------------------------------------------------------
create function public.rw_cfg(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.economy_config where key = k
$$;

create function public.rw_level_coins(lvl text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((value -> 'levels' ->> lvl)::numeric, 0) from public.economy_config where key = 'task_coins'
$$;

-- "Today" for one student, in her own time zone.
create function public.rw_today(sid uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select time_zone from public.profiles where id = sid), 'America/New_York'))::date
$$;

create function public.rw_spendable(sid uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from public.ledger where student_id = sid and status = 'confirmed'
$$;
create function public.rw_held(sid uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from public.ledger where student_id = sid and status = 'held'
$$;

-- The currency's name for this student (theme data). Only the word changes, never a number.
create function public.rw_currency_name(sid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(btrim(currency_skin ->> 'name'), '') from public.reward_packs
                    where student_id = sid order by created_at limit 1), 'coins')
$$;

create function public.rw_in_check_mode(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select check_mode_until > now() from public.student_settings where student_id = sid), false)
$$;

-- One serial lane per student for anything that moves coins or boxes, so two taps cannot race.
create function public.rw_lock(sid uuid) returns void
language sql security definer set search_path = public as $$
  select pg_advisory_xact_lock(hashtextextended('emma-rewards:' || sid::text, 0))
$$;

create function public.rw_notify(p_recipient uuid, p_student uuid, p_kind text, p_body text, p_task uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, student_id, kind, body, task_id) values (p_recipient, p_student, p_kind, p_body, p_task)
$$;

-- Every adult (coaches and parents) linked to a student.
create function public.rw_notify_adults(p_student uuid, p_kind text, p_body text, p_task uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, student_id, kind, body, task_id)
  select distinct adult_id, p_student, p_kind, p_body, p_task from public.student_links where student_id = p_student
$$;

create function public.rw_first_name(pid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select first_name from public.profiles where id = pid), 'A grown-up')
$$;

---------------------------------------------------------------------------------------------------
-- 4. A TASK'S VALUE: set by its level, never by the student, fixed once it is finished
---------------------------------------------------------------------------------------------------
-- Runs after the column guard (t1), so the guard still sees exactly what the person typed.
create function public.tasks_value() returns trigger
language plpgsql set search_path = public as $$
declare signed_in boolean := current_user = 'authenticated';
begin
  if tg_op = 'INSERT' then
    -- Server code may still pass an explicit coin value with no level (old data, tests).
    if new.value_level is null and (signed_in or new.coins = 0) then
      new.value_level := case when new.source = 'student' then 'waiting'
                              when new.type = 'flex' then 'dinner' else 'normal' end;
    end if;
    if new.value_level is not null then
      new.coins := coalesce((select (value -> 'levels' ->> new.value_level)::numeric
                               from public.economy_config where key = 'task_coins'), 0);
    end if;
    if signed_in and public.app_role() = 'coach' then
      new.value_set_by := coalesce(new.value_set_by, case when new.source = 'template' then 'template' else 'coach' end);
    end if;
  elsif new.value_level is distinct from old.value_level then
    if old.done and signed_in then
      raise exception 'the value of a finished task cannot be changed' using errcode = '42501';
    end if;
    if new.value_level is not null then
      new.coins := coalesce((select (value -> 'levels' ->> new.value_level)::numeric
                               from public.economy_config where key = 'task_coins'), 0);
    end if;
    if signed_in then new.value_set_by := 'adult'; end if;
  end if;
  return new;
end $$;
create trigger t5_value before insert or update on public.tasks for each row execute function public.tasks_value();

-- The column guard for tasks, now with coins closed to coaches too (coins follow the level).
drop trigger t1_guard on public.tasks;
create trigger t1_guard before insert or update on public.tasks for each row execute function public.guard_columns(
  '{"student":{"insert":["student_id","date","title","note","due_date","minutes","color_step","sort_order","first_step","start_plan","estimated_minutes"],
                "update":["title","note","date","due_date","minutes","color_step","sort_order","not_today","deleted","first_step","start_plan","estimated_minutes"]},
    "coach":{"insert":{"except":["coins","pays_again","reopened_at","reminder_sent_at","original_date","done","done_at","reward_status","confirmed_at","final_at","review_status","reviewed_by","reviewed_at","review_note","verified_by","verified_at","verified_evidence","proof_note","proof_photo_path","proof_answers","proof_questions","actual_minutes","external_id","source_platform"]},
             "update":{"except":["coins","pays_again","reopened_at","reminder_sent_at","student_id","original_date","source","source_platform","external_id","done","done_at","reward_status","confirmed_at","final_at","review_status","reviewed_by","reviewed_at","review_note","verified_by","verified_at","verified_evidence","proof_note","proof_photo_path","proof_answers","proof_questions","actual_minutes"]}}}');

-- Platform tasks arrive at the normal level (1.5 coins) instead of a hard-coded 3.
create or replace function public.automation_upsert_task(
  raw_key text, p_platform text, p_external_id text, p_title text, p_date date,
  p_due_date date default null, p_note text default null, p_minutes integer default null,
  p_mark_verified boolean default false, p_evidence jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare s uuid := public.automation_student_for_key(raw_key); t uuid;
begin
  if s is null then raise exception 'invalid key' using errcode = '42501'; end if;
  if coalesce(p_platform, '') = '' or coalesce(p_external_id, '') = '' then
    raise exception 'platform and external id are required';
  end if;
  insert into public.tasks (student_id, date, title, note, minutes, due_date, source, source_platform, external_id,
                            value_set_by, value_level, type)
  values (s, p_date, p_title, p_note, p_minutes, p_due_date, 'platform', p_platform, p_external_id,
          'platform', 'normal', 'school')
  on conflict (student_id, source_platform, external_id) where external_id is not null do update
     set title = excluded.title, note = excluded.note, minutes = excluded.minutes,
         due_date = excluded.due_date            -- her own plan for the day (date) is never overwritten
   where public.tasks.done = false
  returning id into t;
  if t is null then
    select id into t from public.tasks where student_id = s and source_platform = p_platform and external_id = p_external_id;
    return t;                                            -- finished tasks are left exactly as they are
  end if;
  if p_mark_verified then
    update public.tasks set verified_by = 'platform', verified_at = now(), verified_evidence = p_evidence where id = t;
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, student_id, details)
  values (null, 'automation', 'tasks', t::text, s, jsonb_build_object('platform', p_platform, 'verified', p_mark_verified));
  return t;
end $$;

---------------------------------------------------------------------------------------------------
-- 5. THE DAY: cleared, full or mini, sparkle (PRD 3a as decided Nov 15)
---------------------------------------------------------------------------------------------------
-- Which of a day's tasks count. Plans (fixed) never do; a task waiting for an adult counts for nothing yet.
create function public.rw_day_quality(sid uuid, d date,
  out checkable int, out cleared boolean, out work_total int, out work_done int, out is_full boolean, out homework boolean)
language plpgsql stable security definer set search_path = public as $$
declare moved uuid[]; moved_n int;
begin
  select count(*), coalesce(bool_and(done or not_today), false),
         count(*) filter (where type <> 'flex'), count(*) filter (where type <> 'flex' and done)
    into checkable, cleared, work_total, work_done
    from public.tasks
   where student_id = sid and date = d and not deleted and type <> 'fixed' and coalesce(value_level, 'normal') <> 'waiting';
  cleared := checkable > 0 and cleared;
  homework := work_total > 0;
  -- Moving a task off its day counts the same as Not today (no dodging work by dragging it away).
  select moved_task_ids into moved from public.day_results where student_id = sid and date = d;
  select count(*) into moved_n from unnest(coalesce(moved, '{}')) m
   where not exists (select 1 from public.tasks t where t.id = m and t.date = d);
  work_total := work_total + moved_n;
  homework := homework or moved_n > 0;
  is_full := work_total > 0 and work_done * 2 >= work_total;
end $$;

-- A full box on a day counts toward sparkle. Gift boxes are always full.
create function public.rw_day_was_full(sid uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select box_earned and (gift or coalesce(box_kind, case when (public.rw_day_quality(sid, d)).is_full then 'full' else 'mini' end) = 'full')
                     from public.day_results where student_id = sid and date = d), false)
$$;

-- Sparkle: today is a full box, and at least 2 of the 3 homework days before it were full boxes
-- (so 3 full boxes out of her last 4 homework days). Days with no homework are skipped.
create function public.rw_sparkle(sid uuid, d date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare prev date[]; fulls int := 0; x date;
begin
  if not (public.rw_day_quality(sid, d)).is_full then return false; end if;
  select array_agg(dd order by dd desc) into prev from (
    select dd from generate_series(d - 60, d - 1, interval '1 day') g(g0), lateral (select g0::date as dd) z
     where (public.rw_day_quality(sid, dd)).homework
        or exists (select 1 from public.day_results r where r.student_id = sid and r.date = dd and r.gift)
     order by dd desc limit 3) s;
  foreach x in array coalesce(prev, '{}') loop
    if public.rw_day_was_full(sid, x) then fulls := fulls + 1; end if;
  end loop;
  return fulls >= 2;
end $$;

-- Keeps a day's box state up to date. A box is earned the moment the day is cleared, on that day
-- (or on a later day when a reopened task is finished again). Only an undo can take an unopened box back.
create function public.rw_refresh_day(sid uuid, d date, allow_past boolean default false, unearn boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare q record; r public.day_results;
begin
  q := public.rw_day_quality(sid, d);
  select * into r from public.day_results where student_id = sid and date = d for update;
  if not found then
    if not (q.cleared and (d = public.rw_today(sid) or allow_past)) then return; end if;
    insert into public.day_results (student_id, date) values (sid, d) on conflict (student_id, date) do nothing;
    select * into r from public.day_results where student_id = sid and date = d for update;
  end if;
  if r.opened or r.gift then return; end if;
  if q.cleared and not r.box_earned and (d = public.rw_today(sid) or allow_past) then
    update public.day_results set box_earned = true, earned_at = now(),
           box_kind = case when q.is_full then 'full' else 'mini' end where id = r.id;
  elsif r.box_earned and not q.cleared and unearn then
    update public.day_results set box_earned = false, earned_at = null, box_kind = null, sparkle = false where id = r.id;
  elsif r.box_earned then
    update public.day_results set box_kind = case when q.is_full then 'full' else 'mini' end
     where id = r.id and box_kind is distinct from case when q.is_full then 'full' else 'mini' end;
  end if;
end $$;

-- After any change to a task: note a move off today, then refresh the days it touched.
create function public.tasks_rewards_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare today date;
begin
  if tg_op = 'UPDATE' and new.date is distinct from old.date and not old.done and not old.deleted
     and old.type not in ('fixed','flex') and coalesce(old.value_level, 'normal') <> 'waiting' then
    today := public.rw_today(old.student_id);
    if old.date = today then
      insert into public.day_results (student_id, date, moved_task_ids) values (old.student_id, old.date, array[old.id])
      on conflict (student_id, date) do update
        set moved_task_ids = case when old.id = any (public.day_results.moved_task_ids) then public.day_results.moved_task_ids
                                  else public.day_results.moved_task_ids || old.id end;
    end if;
  end if;
  if tg_op = 'UPDATE' and old.date is distinct from new.date then
    perform public.rw_refresh_day(old.student_id, old.date);
  end if;
  perform public.rw_refresh_day(new.student_id, new.date,
            tg_op = 'UPDATE' and new.done and not old.done and new.reopened_at is not null);
  return null;
end $$;
create trigger t6_rewards after insert or update of done, not_today, date, deleted, type, value_level on public.tasks
  for each row execute function public.tasks_rewards_after();

---------------------------------------------------------------------------------------------------
-- 6. CONFIRMING, FINISHING, UNDOING (server code only)
---------------------------------------------------------------------------------------------------
create function public.rw_confirm_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ledger set status = 'confirmed', confirmed_at = now()
   where task_id = p_task and status = 'held' and kind in ('earn','egg');
  update public.tasks set reward_status = 'confirmed', confirmed_at = now()
   where id = p_task and done and reward_status = 'provisional';
end $$;

-- A skill coin, once per real thing. Returns the coins paid (0 if already paid for that thing).
create function public.rewards_award_skill(p_student uuid, p_kind text, p_ref text, p_task uuid default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare amt numeric := coalesce((public.rw_cfg('skill_coins') ->> p_kind)::numeric, 0); ev uuid;
begin
  if p_kind not in ('starting','writing_down','packing','planning') or coalesce(p_ref, '') = '' then
    raise exception 'unknown skill or missing reference';
  end if;
  insert into public.skill_events (student_id, kind, task_id, ref, coins) values (p_student, p_kind, p_task, p_ref, amt)
  on conflict (student_id, kind, ref) where ref is not null do nothing returning id into ev;
  if ev is null or amt <= 0 then return 0; end if;
  insert into public.ledger (student_id, kind, amount, status, task_id, note, confirmed_at)
  values (p_student, 'skill', amt, 'confirmed', p_task, p_kind, now());
  return amt;
end $$;

-- Called once by the proof checker (step 5) after proof is accepted.
--   p_proof: 'pass' (checks passed), 'flagged' (accepted but unclear), 'verified' (platform), 'no_proof_needed'
create function public.rewards_finish_task(p_task uuid, p_proof text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tasks; s record; hatched boolean := false; trusted boolean; paid numeric := 0; egg numeric := 0;
        st text; win interval := make_interval(hours => (public.rw_cfg('review') ->> 'window_hours')::int);
begin
  if p_proof not in ('pass','flagged','verified','no_proof_needed') then raise exception 'unknown proof result'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'no such task'; end if;
  perform public.rw_lock(t.student_id);
  if t.done then return jsonb_build_object('status', 'already_done'); end if;
  if t.deleted or t.type = 'fixed' then raise exception 'this task cannot be checked off'; end if;

  -- The egg: she pressed Start on this same task and it is still running.
  select id, started_at into s from public.work_sessions
   where task_id = p_task and ended_at is null order by started_at desc limit 1;
  if s.id is not null then
    hatched := true;
    update public.work_sessions set ended_at = now(), end_kind = 'finished' where id = s.id;
    if now() - s.started_at >= make_interval(mins => (public.rw_cfg('skill_coins') ->> 'starting_min_minutes')::int) then
      perform public.rewards_award_skill(t.student_id, 'starting', 'task:' || p_task, p_task);
    end if;
  end if;

  trusted := (t.source <> 'student' or t.value_set_by in ('ai_intake','adult'))
         and coalesce(t.value_level, 'normal') <> 'waiting'
         and p_proof <> 'flagged'
         and not exists (select 1 from public.integrity_flags f where f.task_id = p_task and f.status = 'open')
         and not public.rw_in_check_mode(t.student_id);
  st := case when trusted then 'confirmed' else 'held' end;

  if t.pays_again then
    if t.coins > 0 then
      paid := t.coins;
      insert into public.ledger (student_id, kind, amount, status, task_id, confirmed_at)
      values (t.student_id, 'earn', t.coins, st, p_task, case when trusted then now() end);
    end if;
    if hatched then
      egg := coalesce((public.rw_cfg('egg_coins'))::text::numeric, 1);
      insert into public.ledger (student_id, kind, amount, status, task_id, confirmed_at)
      values (t.student_id, 'egg', egg, st, p_task, case when trusted then now() end);
    end if;
  end if;

  update public.tasks set done = true, done_at = now(), not_today = false,
         reward_status = case when trusted then 'confirmed' else 'provisional' end,
         confirmed_at = case when trusted then now() end, final_at = now() + win,
         review_status = 'unreviewed', reviewed_by = null, reviewed_at = null, reminder_sent_at = null
   where id = p_task;
  -- The day's box is refreshed by the tasks trigger.
  return jsonb_build_object('status', st, 'coins', paid, 'egg', egg, 'hatched', hatched, 'pays_again', t.pays_again);
end $$;

-- After "Needs more", she adds more proof (step 5 calls this). The 24-hour clock restarts.
create function public.rewards_proof_added(p_task uuid, p_proof text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tasks; trusted boolean;
        win interval := make_interval(hours => (public.rw_cfg('review') ->> 'window_hours')::int);
begin
  if p_proof not in ('pass','flagged','verified') then raise exception 'unknown proof result'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found or not t.done or t.review_status <> 'needs_more' then raise exception 'this task is not waiting for more proof'; end if;
  perform public.rw_lock(t.student_id);
  update public.tasks set review_status = 'unreviewed', final_at = now() + win, reminder_sent_at = null where id = p_task;
  trusted := (t.source <> 'student' or t.value_set_by in ('ai_intake','adult'))
         and p_proof <> 'flagged'
         and not exists (select 1 from public.integrity_flags f where f.task_id = p_task and f.status = 'open')
         and not public.rw_in_check_mode(t.student_id);
  if trusted then perform public.rw_confirm_task(p_task); end if;
  return jsonb_build_object('status', case when trusted then 'confirmed' else 'held' end);
end $$;

-- Undo a finished task's rewards. Used by an adult's Not done and by her own uncheck (step 5).
-- Held and unspent coins are removed; a spent part is forgiven (never a negative balance); an opened
-- box keeps its item. If anything was forgiven, doing the task again pays nothing.
create function public.rewards_undo_task(p_task uuid, p_by uuid, p_kind text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tasks; c numeric; b numeric; removable numeric := 0; forgiven numeric := 0;
        r public.day_results; box_forgiven boolean := false; first_earn uuid;
begin
  if p_kind not in ('not_done','uncheck') then raise exception 'unknown undo kind'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'no such task'; end if;
  if not t.done then raise exception 'this task is not finished'; end if;
  perform public.rw_lock(t.student_id);

  update public.ledger set status = 'reversed' where task_id = p_task and kind in ('earn','egg') and status = 'held';

  select coalesce(sum(amount), 0), (array_agg(id order by created_at))[1] into c, first_earn
    from public.ledger where task_id = p_task and kind in ('earn','egg') and status = 'confirmed';
  if c > 0 then
    b := public.rw_spendable(t.student_id);
    removable := least(c, greatest(b, 0));
    forgiven := c - removable;
    update public.ledger set status = 'reversed' where task_id = p_task and kind in ('earn','egg') and status = 'confirmed';
    if forgiven > 0 then
      insert into public.ledger (student_id, kind, amount, status, task_id, reverses_id, note, confirmed_at)
      values (t.student_id, 'forgiven', forgiven, 'confirmed', p_task, first_earn, 'already spent, forgiven', now());
    end if;
  end if;

  select * into r from public.day_results where student_id = t.student_id and date = t.date;
  box_forgiven := coalesce(r.opened and p_task = any (r.counted_task_ids), false);

  update public.tasks set done = false, done_at = null, reward_status = 'reversed', confirmed_at = null, final_at = null,
         reopened_at = now(), reminder_sent_at = null,
         pays_again = pays_again and not (forgiven > 0 or box_forgiven),
         review_status = case when p_kind = 'not_done' then 'not_done' else review_status end,
         reviewed_by = case when p_kind = 'not_done' then p_by else reviewed_by end,
         reviewed_at = case when p_kind = 'not_done' then now() else reviewed_at end,
         review_note = case when p_kind = 'not_done' then p_note else review_note end
   where id = p_task;
  perform public.rw_refresh_day(t.student_id, t.date, false, true);

  if forgiven > 0 or box_forgiven then
    insert into public.integrity_flags (student_id, task_id, kind, detail)
    values (t.student_id, p_task, 'rewards_forgiven',
            'Reopened after its rewards were used: '
            || concat_ws(' and ', case when forgiven > 0 then trim(to_char(forgiven, 'FM990.0')) || ' spent coins forgiven' end,
                                  case when box_forgiven then 'the opened box keeps its item' end)
            || '. Doing it again pays nothing.');
  end if;
  return jsonb_build_object('removed_confirmed', removable, 'forgiven', forgiven, 'box_forgiven', box_forgiven,
                            'pays_again', not (forgiven > 0 or box_forgiven) and t.pays_again);
end $$;

-- Runs every 15 minutes on the server (pg_cron). Confirms held rewards whose 24 hours are up, and
-- reminds the adults about 4 hours before. A task an adult sent back with Needs more waits for her.
create function public.rewards_tick() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; confirmed int := 0; reminded int := 0;
begin
  for t in select id from public.tasks
            where done and reward_status = 'provisional' and review_status <> 'needs_more' and final_at <= now() loop
    perform public.rw_confirm_task(t.id); confirmed := confirmed + 1;
  end loop;
  for t in select id, student_id, title from public.tasks
            where done and reward_status = 'provisional' and review_status <> 'needs_more' and reminder_sent_at is null
              and final_at > now() and final_at <= now() + interval '4 hours' loop
    perform public.rw_notify_adults(t.student_id, 'review_reminder',
      public.rw_first_name(t.student_id) || '''s "' || t.title || '" is waiting for a look. It counts automatically in about 4 hours.', t.id);
    update public.tasks set reminder_sent_at = now() where id = t.id;
    reminded := reminded + 1;
  end loop;
  return jsonb_build_object('confirmed', confirmed, 'reminded', reminded);
end $$;

-- Packing: ticking off the whole bring-home list for tonight pays one skill coin, once per night.
create function public.bring_home_rewards_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.packed and not old.packed and new.date = public.rw_today(new.student_id)
     and not exists (select 1 from public.bring_home b where b.student_id = new.student_id and b.date = new.date and not b.packed) then
    perform public.rewards_award_skill(new.student_id, 'packing', 'night:' || new.date);
  end if;
  return null;
end $$;
create trigger t6_rewards after update of packed on public.bring_home for each row execute function public.bring_home_rewards_after();

---------------------------------------------------------------------------------------------------
-- 7. ADULTS: review (Looks good, Needs more, Not done), strikes, gifts, approving a value
---------------------------------------------------------------------------------------------------
create function public.review_task(p_task uuid, p_verdict text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tasks; me uuid := auth.uid(); who text; cur text; strikes int; st public.student_settings;
        cfg jsonb := public.rw_cfg('strikes'); coach_name text;
begin
  select * into t from public.tasks where id = p_task;
  if not found or me is null or not (public.is_coach_of(t.student_id) or public.is_parent_of(t.student_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_verdict not in ('looks_good','needs_more','not_done') then raise exception 'unknown verdict'; end if;
  if not t.done then raise exception 'this task is not finished'; end if;
  who := public.rw_first_name(me);
  cur := public.rw_currency_name(t.student_id);

  if p_verdict = 'looks_good' then
    update public.tasks set review_status = 'looks_good', reviewed_by = me, reviewed_at = now(), review_note = p_note where id = p_task;
    perform public.rw_confirm_task(p_task);
    return jsonb_build_object('status', 'confirmed');
  end if;

  if t.final_at is null or now() >= t.final_at then
    raise exception 'the 24-hour review window for this task has closed';
  end if;

  if p_verdict = 'needs_more' then
    update public.tasks set review_status = 'needs_more', reviewed_by = me, reviewed_at = now(), review_note = p_note where id = p_task;
    perform public.rw_notify(t.student_id, t.student_id, 'needs_more',
      who || ' asked for a little more on "' || t.title || '". Add a bit more and it will count.', p_task);
    return jsonb_build_object('status', 'needs_more');
  end if;

  -- Not done: undo the rewards, a calm and clear message for her, and a strike only adults can see.
  perform public.rewards_undo_task(p_task, me, 'not_done', p_note);
  perform public.rw_notify(t.student_id, t.student_id, 'reopened',
    who || ' checked "' || t.title || '" and it wasn''t finished yet. ' || initcap(cur)
    || ' only come from real work. Finish it for real to earn them.', p_task);
  insert into public.integrity_flags (student_id, task_id, kind, detail)
  values (t.student_id, p_task, 'not_done', 'Marked Not done by ' || who || coalesce(': ' || p_note, ''));

  select * into st from public.student_settings where student_id = t.student_id for update;
  select count(*) into strikes from public.integrity_flags
   where student_id = t.student_id and kind = 'not_done'
     and created_at > now() - make_interval(days => (cfg ->> 'window_days')::int)
     and created_at > coalesce(st.check_mode_started_at, '-infinity'::timestamptz);
  if strikes >= (cfg ->> 'count')::int and not public.rw_in_check_mode(t.student_id) then
    insert into public.student_settings (student_id) values (t.student_id) on conflict (student_id) do nothing;
    update public.student_settings set check_mode_started_at = now(),
           check_mode_until = now() + make_interval(days => (cfg ->> 'check_mode_days')::int)
     where student_id = t.student_id;
    select first_name into coach_name from public.profiles p join public.student_links l on l.adult_id = p.id
     where l.student_id = t.student_id and l.relation = 'coach' order by l.created_at limit 1;
    perform public.rw_notify(t.student_id, t.student_id, 'check_mode',
      'For this week, ' || coalesce(coach_name, 'a grown-up') || ' will check your work before ' || cur || ' count.', null);
    perform public.rw_notify_adults(t.student_id, 'check_mode',
      'Check mode is on for ' || public.rw_first_name(t.student_id) || ' for '
      || (cfg ->> 'check_mode_days') || ' days: ' || strikes || ' tasks were marked Not done in '
      || (cfg ->> 'window_days') || ' days. Her coins wait for a look, and her proof must pass first.', null);
  end if;
  return jsonb_build_object('status', 'reopened');
end $$;

-- A coach approves (or changes) the value of a task. For a finished task that was waiting for an adult,
-- this is the moment it pays.
create function public.approve_task_value(p_task uuid, p_level text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tasks; amt numeric;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or not public.is_coach_of(t.student_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_level is null or p_level = 'waiting' or p_level not in ('must','high','normal','low','optional','dinner') then
    raise exception 'unknown level';
  end if;
  perform public.rw_lock(t.student_id);
  if not t.done then
    update public.tasks set value_level = p_level, value_set_by = 'adult' where id = p_task;
    return jsonb_build_object('status', 'set', 'coins', public.rw_level_coins(p_level));
  end if;
  if coalesce(t.value_level, 'normal') <> 'waiting' then
    raise exception 'the value of a finished task cannot be changed';
  end if;
  amt := public.rw_level_coins(p_level);
  update public.tasks set value_level = p_level, value_set_by = 'adult', coins = amt where id = p_task;
  if t.pays_again and amt > 0 then
    insert into public.ledger (student_id, kind, amount, status, task_id, confirmed_at)
    values (t.student_id, 'earn', amt, 'confirmed', p_task, now());
  end if;
  update public.tasks set reward_status = 'confirmed', confirmed_at = now() where id = p_task;
  perform public.rw_refresh_day(t.student_id, t.date, true, false);
  return jsonb_build_object('status', 'paid', 'coins', amt);
end $$;

create function public.give_coins(p_student uuid, p_amount numeric, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g jsonb := public.rw_cfg('gifts');
begin
  if not public.is_coach_of(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_amount is null or p_amount < (g ->> 'coins_min')::numeric or p_amount > (g ->> 'coins_max')::numeric
     or p_amount * 2 <> trunc(p_amount * 2) then
    raise exception 'a gift is between % and % coins', g ->> 'coins_min', g ->> 'coins_max';
  end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'say why (it is logged)'; end if;
  perform public.rw_lock(p_student);
  insert into public.ledger (student_id, kind, amount, status, note, confirmed_at)
  values (p_student, 'gift', p_amount, 'confirmed', 'given by ' || public.rw_first_name(auth.uid()) || ': ' || p_note, now());
  return jsonb_build_object('status', 'given', 'spendable', public.rw_spendable(p_student));
end $$;

create function public.give_box(p_student uuid, p_date date, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.day_results;
begin
  if not public.is_coach_of(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'say why (it is logged)'; end if;
  perform public.rw_lock(p_student);
  insert into public.day_results (student_id, date) values (p_student, p_date) on conflict (student_id, date) do nothing;
  select * into r from public.day_results where student_id = p_student and date = p_date for update;
  if r.opened then raise exception 'that day already has an opened box; pick another day'; end if;
  update public.day_results set box_earned = true, earned_at = coalesce(earned_at, now()), gift = true, box_kind = 'full',
         gift_note = 'given by ' || public.rw_first_name(auth.uid()) || ': ' || p_note
   where id = r.id;
  return jsonb_build_object('status', 'given', 'date', p_date);
end $$;

---------------------------------------------------------------------------------------------------
-- 8. THE STUDENT: open a box, the shop, buying, her wallet
---------------------------------------------------------------------------------------------------
-- Pure rule: which rarity a roll (0 to 100) asks for. Mini boxes are commons.
create function public.rw_box_rarity(p_roll numeric, p_kind text) returns text
language plpgsql stable security definer set search_path = public as $$
declare o jsonb; acc numeric := 0; k text;
begin
  if p_kind = 'mini' then return 'common'; end if;
  o := public.rw_cfg('box_odds') -> (case when p_kind = 'sparkle' then 'sparkle' else 'normal' end);
  foreach k in array array['legendary','rare','uncommon','common'] loop
    acc := acc + (o ->> k)::numeric * 100;
    if p_roll < acc then return k; end if;
  end loop;
  return 'common';
end $$;

-- A strong random number from 0 up to (not including) 100.
create function public.rw_roll() returns numeric
language sql volatile security definer set search_path = public as $$
  select (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 1000000) / 10000.0
$$;

-- Never a duplicate. If the wanted rarity has nothing left, the nearest rarity is used (as the old code did).
create function public.rw_box_pick(sid uuid, want text) returns public.catalog_items
language plpgsql volatile security definer set search_path = public as $$
declare rk int := array_position(array['legendary','rare','uncommon','common'], want); it public.catalog_items;
begin
  select ci.* into it from public.catalog_items ci
   where ci.student_id = sid and ci.status = 'approved' and ci.rarity is not null
     and not exists (select 1 from public.collection c where c.student_id = sid and c.item_id in (ci.id::text, ci.legacy_id))
   order by abs(array_position(array['legendary','rare','uncommon','common'], ci.rarity) - rk),
            array_position(array['legendary','rare','uncommon','common'], ci.rarity), gen_random_uuid()
   limit 1;
  return it;
end $$;

create function public.open_box(p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := auth.uid(); r public.day_results; q record; bk text; is_sparkle boolean := false;
        it public.catalog_items; owned record; counted uuid[];
begin
  if sid is null or public.app_role() is distinct from 'student' then raise exception 'only the student opens her box' using errcode = '42501'; end if;
  perform public.rw_lock(sid);
  select * into r from public.day_results where student_id = sid and date = p_date for update;
  if not found or not r.box_earned then return jsonb_build_object('status', 'none'); end if;
  if r.opened then
    select c.item_id, c.item_name, c.rarity into owned from public.collection c where c.student_id = sid and c.box_date = p_date and c.acquired_via = 'box' limit 1;
    return jsonb_build_object('status', 'opened', 'already', true, 'item_id', owned.item_id, 'name', owned.item_name,
                              'rarity', owned.rarity, 'kind', r.box_kind, 'sparkle', r.sparkle);
  end if;
  if not r.gift then
    if exists (select 1 from public.tasks t where t.student_id = sid and t.date = p_date and t.done and not t.deleted
                 and t.type <> 'fixed' and coalesce(t.value_level, 'normal') <> 'waiting' and t.reward_status <> 'confirmed') then
      return jsonb_build_object('status', 'waiting');     -- at most 24 hours; the app says it kindly
    end if;
    q := public.rw_day_quality(sid, p_date);
    bk := case when q.is_full then 'full' else 'mini' end;
    is_sparkle := q.is_full and public.rw_sparkle(sid, p_date);
  else
    bk := 'full';
  end if;
  it := public.rw_box_pick(sid, public.rw_box_rarity(public.rw_roll(), case when is_sparkle then 'sparkle' else bk end));
  if it.id is null then
    if not exists (select 1 from public.integrity_flags where student_id = sid and kind = 'box_pool_empty' and status = 'open') then
      insert into public.integrity_flags (student_id, kind, detail) values (sid, 'box_pool_empty', 'A box is waiting: every approved item is already owned. Add items to the pack.');
      perform public.rw_notify_adults(sid, 'box_pool_empty', public.rw_first_name(sid) || ' has a box waiting, but owns every item in her pack. Add new items.');
    end if;
    return jsonb_build_object('status', 'new_items_coming');
  end if;
  select coalesce(array_agg(t.id), '{}') into counted from public.tasks t
   where t.student_id = sid and t.date = p_date and t.done and not t.deleted and t.type <> 'fixed'
     and coalesce(t.value_level, 'normal') <> 'waiting';
  insert into public.collection (student_id, item_id, item_name, rarity, acquired_via, box_date)
  values (sid, it.id::text, it.name, it.rarity, 'box', p_date);
  update public.day_results set opened = true, opened_at = now(), box_item_id = it.id::text, box_kind = bk,
         sparkle = is_sparkle, counted_task_ids = counted
   where id = r.id;
  return jsonb_build_object('status', 'opened', 'already', false, 'item_id', it.id, 'name', it.name, 'rarity', it.rarity,
                            'image_ref', it.image_ref, 'category', it.category, 'kind', bk, 'sparkle', is_sparkle);
end $$;

-- This week's shop: 12 common and uncommon items, a fixed shuffle for the week, dealt evenly across the
-- pack's categories, nothing she owns. Readable by the student and her adults.
create function public.get_shop(p_student uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(p_student, auth.uid()); wk date; ids text[]; cfg jsonb := public.rw_cfg('shop'); out jsonb;
begin
  if sid is null or not public.can_read_student(sid) or public.app_role() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = sid and role = 'student') then raise exception 'not allowed' using errcode = '42501'; end if;
  wk := public.rw_today(sid) - ((extract(isodow from public.rw_today(sid))::int + 6) % 7);
  select item_ids into ids from public.shop_weeks where student_id = sid and week_start = wk;
  if ids is null then
    select coalesce(array_agg(id::text order by rn, catkey), '{}') into ids from (
      select id, rn, md5(cat || wk::text || sid::text) as catkey from (
        select ci.id, coalesce(ci.category, '') as cat,
               row_number() over (partition by coalesce(ci.category, '') order by md5(sid::text || wk::text || ci.id::text)) as rn
          from public.catalog_items ci
         where ci.student_id = sid and ci.status = 'approved' and ci.rarity in ('common','uncommon')
           and not exists (select 1 from public.collection c where c.student_id = sid and c.item_id in (ci.id::text, ci.legacy_id))) a
       order by rn, md5(cat || wk::text || sid::text)
       limit (cfg ->> 'size')::int) b;
    insert into public.shop_weeks (student_id, week_start, item_ids) values (sid, wk, ids)
    on conflict (student_id, week_start) do nothing;
    select item_ids into ids from public.shop_weeks where student_id = sid and week_start = wk;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', ci.id, 'name', ci.name, 'rarity', ci.rarity, 'category', ci.category,
                                               'image_ref', ci.image_ref, 'price', (cfg -> 'prices' ->> ci.rarity)::numeric)
                            order by array_position(ids, ci.id::text)), '[]'::jsonb) into out
    from public.catalog_items ci
   where ci.id::text = any (ids) and ci.status = 'approved'
     and not exists (select 1 from public.collection c where c.student_id = sid and c.item_id in (ci.id::text, ci.legacy_id));
  return jsonb_build_object('week_start', wk, 'items', out, 'currency', public.rw_currency_name(sid));
end $$;

create function public.buy_item(p_item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := auth.uid(); it public.catalog_items; wk date; price numeric; bal numeric;
begin
  if sid is null or public.app_role() is distinct from 'student' then raise exception 'only the student buys from her shop' using errcode = '42501'; end if;
  perform public.rw_lock(sid);
  perform public.get_shop(sid);                                     -- makes sure this week's shop exists
  wk := public.rw_today(sid) - ((extract(isodow from public.rw_today(sid))::int + 6) % 7);
  select * into it from public.catalog_items where id = p_item and student_id = sid and status = 'approved';
  if not found or not exists (select 1 from public.shop_weeks where student_id = sid and week_start = wk and p_item::text = any (item_ids)) then
    raise exception 'that is not in this week''s shop';
  end if;
  if it.rarity not in ('common','uncommon') then raise exception 'that is not for sale'; end if;
  if exists (select 1 from public.collection c where c.student_id = sid and c.item_id in (it.id::text, it.legacy_id)) then
    raise exception 'you already have that one';
  end if;
  price := (public.rw_cfg('shop') -> 'prices' ->> it.rarity)::numeric;
  bal := public.rw_spendable(sid);
  if bal < price then
    raise exception 'not enough yet: % more needed', price - bal;
  end if;
  insert into public.ledger (student_id, kind, amount, status, note, confirmed_at)
  values (sid, 'purchase', -price, 'confirmed', it.name, now());
  insert into public.collection (student_id, item_id, item_name, rarity, acquired_via)
  values (sid, it.id::text, it.name, it.rarity, 'shop');
  return jsonb_build_object('status', 'bought', 'item_id', it.id, 'price', price, 'spendable', public.rw_spendable(sid));
end $$;

-- Her counter: spendable coins, coins still waiting, and the currency's look (theme data).
create function public.my_wallet(p_student uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid := coalesce(p_student, auth.uid());
begin
  if sid is null or not public.can_read_student(sid) or public.app_role() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object('spendable', public.rw_spendable(sid), 'waiting', public.rw_held(sid),
    'currency', coalesce((select currency_skin from public.reward_packs where student_id = sid order by created_at limit 1),
                         '{"name":"coins","look":"gold"}'::jsonb));
end $$;

-- The rewards strip for one day: progress toward clearing, full box and sparkle. Never a "lost" message.
create function public.day_status(p_student uuid, p_date date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q record; r public.day_results; prev int := 0; x date; hw date[];
begin
  if not public.can_read_student(p_student) or public.app_role() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  q := public.rw_day_quality(p_student, p_date);
  select * into r from public.day_results where student_id = p_student and date = p_date;
  select array_agg(dd order by dd desc) into hw from (
    select g0::date as dd from generate_series(p_date - 60, p_date - 1, interval '1 day') g(g0)
     where (public.rw_day_quality(p_student, g0::date)).homework order by 1 desc limit 3) s;
  foreach x in array coalesce(hw, '{}') loop
    if public.rw_day_was_full(p_student, x) then prev := prev + 1; end if;
  end loop;
  return jsonb_build_object('cleared', q.cleared, 'done', q.work_done, 'total', q.work_total,
    'need_for_full', greatest(0, ceil(q.work_total / 2.0)::int - q.work_done), 'full', q.is_full,
    'box_earned', coalesce(r.box_earned, false), 'opened', coalesce(r.opened, false), 'gift', coalesce(r.gift, false),
    'waiting', exists (select 1 from public.tasks t where t.student_id = p_student and t.date = p_date and t.done
                         and t.reward_status = 'provisional'),
    'sparkle_ready', public.rw_sparkle(p_student, p_date), 'full_days_before', prev);
end $$;

-- The weekly real prize: a Monday to Sunday week that has ended, with at most one homework day missed,
-- at least one box, and every reward in the week confirmed. Buying it is step 9.
create function public.real_pick_status(p_student uuid, p_week_start date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date; hw int := 0; boxes int := 0; missed int := 0; allowed int := (public.rw_cfg('real_pick') ->> 'missed_homework_days_allowed')::int;
        waiting boolean; ended boolean;
begin
  if not public.can_read_student(p_student) or public.app_role() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if extract(isodow from p_week_start) <> 1 then raise exception 'a week starts on a Monday'; end if;
  for d in select g::date from generate_series(p_week_start, p_week_start + 6, interval '1 day') g loop
    if exists (select 1 from public.day_results r where r.student_id = p_student and r.date = d and r.box_earned) then
      boxes := boxes + 1;
      if (public.rw_day_quality(p_student, d)).homework then hw := hw + 1; end if;
    elsif (public.rw_day_quality(p_student, d)).homework then
      hw := hw + 1; missed := missed + 1;
    end if;
  end loop;
  waiting := exists (select 1 from public.tasks t where t.student_id = p_student and t.done and t.reward_status = 'provisional'
                       and t.date between p_week_start and p_week_start + 6);
  ended := public.rw_today(p_student) > p_week_start + 6;
  return jsonb_build_object('ended', ended, 'homework_days', hw, 'boxes', boxes, 'missed', missed,
    'earned', ended and boxes > 0 and missed <= allowed, 'confirmed', not waiting,
    'ready', ended and boxes > 0 and missed <= allowed and not waiting);
end $$;

-- For the proof checker (step 5): check mode raises the strictness to strict for its 7 days.
create function public.effective_proof_strictness(p_student uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when public.rw_in_check_mode(p_student) then 'strict'
              else coalesce((select proof_strictness from public.student_settings where student_id = p_student), 'normal') end
$$;

-- Copy the shared squishy list (the old Code.gs items) into one student's pack as approved items.
-- Used once for Emma when her account exists. Safe to run again (skips items already copied).
create function public.copy_reward_catalog_to_pack(p_student uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare pk uuid; n int;
begin
  if not public.is_coach_of(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  select id into pk from public.reward_packs where student_id = p_student order by created_at limit 1;
  if pk is null then raise exception 'this student has no reward pack yet'; end if;
  insert into public.catalog_items (pack_id, student_id, name, image_ref, price_usd, tags, rarity, source, status,
                                    category, legacy_id, approved_by, approved_at)
  select pk, p_student, rc.name, 'squishy:' || rc.kind || ':' || coalesce(rc.color, '') || ':' || coalesce(rc.texture, ''),
         rc.price_usd, array_remove(array[rc.kind, rc.color, rc.texture], null), rc.rarity, 'hand_made', 'approved',
         rc.cat, rc.id, auth.uid(), now()
    from public.reward_catalog rc
   where rc.active
     and not exists (select 1 from public.catalog_items ci where ci.student_id = p_student and ci.legacy_id = rc.id);
  get diagnostics n = row_count;
  return n;
end $$;

---------------------------------------------------------------------------------------------------
-- 9. WHO MAY CALL WHAT
---------------------------------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('rw_cfg','rw_level_coins','rw_today','rw_spendable','rw_held','rw_currency_name','rw_in_check_mode',
                                'rw_lock','rw_notify','rw_notify_adults','rw_first_name','tasks_value','rw_day_quality','rw_day_was_full',
                                'rw_sparkle','rw_refresh_day','tasks_rewards_after','rw_confirm_task','rewards_award_skill',
                                'rewards_finish_task','rewards_proof_added','rewards_undo_task','rewards_tick','bring_home_rewards_after',
                                'review_task','approve_task_value','give_coins','give_box','rw_box_rarity','rw_roll','rw_box_pick',
                                'open_box','get_shop','buy_item','my_wallet','day_status','real_pick_status','effective_proof_strictness',
                                'copy_reward_catalog_to_pack','automation_upsert_task') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- The app: a student opens her box, sees her shop, buys, reads her wallet and progress.
-- Adults review, give, approve a value, and copy the squishy list. Each function checks who is asking.
grant execute on function
  public.open_box(date), public.get_shop(uuid), public.buy_item(uuid), public.my_wallet(uuid),
  public.day_status(uuid, date), public.real_pick_status(uuid, date),
  public.review_task(uuid, text, text), public.approve_task_value(uuid, text),
  public.give_coins(uuid, numeric, text), public.give_box(uuid, date, text), public.copy_reward_catalog_to_pack(uuid)
  to authenticated;
-- Server code only (the proof checker in step 5, the scheduler).
grant execute on function
  public.rewards_finish_task(uuid, text), public.rewards_proof_added(uuid, text), public.rewards_undo_task(uuid, uuid, text, text),
  public.rewards_award_skill(uuid, text, text, uuid), public.rewards_tick(), public.effective_proof_strictness(uuid),
  public.automation_upsert_task(text, text, text, text, date, date, text, integer, boolean, jsonb)
  to service_role;

---------------------------------------------------------------------------------------------------
-- 10. THE TIMER: auto-confirm and reminders every 15 minutes, on the server (no phone or browser needed)
---------------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('emma-rewards-tick', '*/15 * * * *', 'select public.rewards_tick()');
  end if;
end $$;
