-- Step 2, part 5: the ADHD profile (sensitive), projects and planning, the tutor, and plan history.

-- ADHD PROFILE (PRD 6e) -------------------------------------------------------------------------
-- Health-related and optional. No diagnosis or medication fields. Stored apart from task data.
-- The table itself is closed to the app. The coach, the student and her parent reach it only through
-- two functions (below) that check who is asking and write every read to the audit log.
create table public.adhd_profiles (
  student_id            uuid primary key references public.profiles(id) on delete cascade,
  answers               jsonb not null default '{}'::jsonb,      -- the "How I work" answers
  filled_by             text check (filled_by in ('parent','coach','student','clinician_form')),
  filled_at             timestamptz,
  upload_path           text,                                    -- a clinician form upload
  upload_approved_by    uuid references public.profiles(id),     -- the parent who approved that version
  consent_stored        boolean not null default false,
  consent_stored_by     uuid references public.profiles(id),
  consent_stored_at     timestamptz,
  consent_helper        boolean not null default false,          -- the Helper may receive derived settings
  consent_helper_by     uuid references public.profiles(id),
  consent_helper_at     timestamptz,
  version               integer not null default 1,
  updated_at            timestamptz not null default now()
);
alter table public.adhd_profiles enable row level security;   -- no policies: closed to everyone but the functions

-- The derived settings the app and the Helper actually use. This is the only part the Helper receives.
create table public.profile_settings (
  student_id        uuid primary key references public.profiles(id) on delete cascade,
  first_step_size   text,
  timer_style       text,
  break_lengths     jsonb,
  plan_slack        numeric(4,2),
  items_shown       integer check (items_shown is null or items_shown between 1 and 20),
  reminder_style    jsonb,
  tone              jsonb,
  avoided_words     text[] not null default '{}',
  focus_windows     jsonb,
  updated_at        timestamptz not null default now()
);

create table public.profile_suggestions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  change      jsonb not null,
  reason      text,
  status      text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  decided_by  uuid references public.profiles(id),
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index profile_suggestions_student_idx on public.profile_suggestions (student_id);

create table public.skill_events (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('starting','writing_down','packing','planning')),
  task_id     uuid references public.tasks(id) on delete set null,
  at          timestamptz not null default now()
);
create index skill_events_student_idx on public.skill_events (student_id, at desc);

alter table public.profile_settings    enable row level security;
alter table public.profile_suggestions enable row level security;
alter table public.skill_events        enable row level security;

create policy profile_settings_read on public.profile_settings for select to authenticated using (public.can_read_student(student_id));
create policy profile_settings_coach on public.profile_settings for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy profile_suggestions_read on public.profile_suggestions for select to authenticated using (public.can_read_student(student_id));
-- Only a coach approves or rejects a suggestion (new ones are written by the server).
create policy profile_suggestions_decide on public.profile_suggestions for update to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create trigger t1_guard before update on public.profile_suggestions for each row
  execute function public.guard_columns('{"coach":{"update":["status"]}}');
create function public.stamp_decision() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and new.status is distinct from old.status then
    new.decided_by := auth.uid(); new.decided_at := now();
  end if;
  return new;
end $$;
create trigger t2_stamp before update on public.profile_suggestions for each row execute function public.stamp_decision();
create policy skill_events_read on public.skill_events for select to authenticated using (public.can_read_student(student_id));
create trigger t3_touch before update on public.profile_settings for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update on public.profile_suggestions for each row execute function public.audit_change();
create trigger t4_audit after insert or update on public.profile_settings for each row execute function public.audit_change();

-- Reading the profile. The coach, the student herself and her parent only. Every read is logged (without its content).
create function public.read_adhd_profile(sid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null or not public.can_read_student(sid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, student_id)
  values (auth.uid(), 'read', 'adhd_profiles', sid::text, sid);
  select to_jsonb(a) into r from public.adhd_profiles a where a.student_id = sid;
  return r;
end $$;

-- Saving the profile. A student can write only her own answers. A coach writes answers. Only a parent
-- can record consent. filled_by is set from who is really calling, never taken from the caller.
create function public.save_adhd_profile(
  sid uuid, p_answers jsonb, p_consent_stored boolean default null, p_consent_helper boolean default null,
  p_upload_path text default null) returns integer
language plpgsql security definer set search_path = public as $$
declare who text := public.app_role(); fb text; v integer;
begin
  if auth.uid() is null or not public.can_read_student(sid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  fb := case when who = 'student' then 'student' when who = 'coach' then 'coach'
             when p_upload_path is not null then 'clinician_form' else 'parent' end;
  if who <> 'parent' and (p_consent_stored is not null or p_consent_helper is not null or p_upload_path is not null) then
    raise exception 'only a parent can record consent or approve an upload' using errcode = '42501';
  end if;
  insert into public.adhd_profiles (student_id, answers, filled_by, filled_at)
  values (sid, coalesce(p_answers, '{}'::jsonb), fb, now())
  on conflict (student_id) do update
     set answers = coalesce(p_answers, public.adhd_profiles.answers), filled_by = fb, filled_at = now(),
         version = public.adhd_profiles.version + 1, updated_at = now();
  if who = 'parent' then
    update public.adhd_profiles set
      consent_stored    = coalesce(p_consent_stored, consent_stored),
      consent_stored_by = case when coalesce(p_consent_stored, consent_stored) then auth.uid() end,
      consent_stored_at = case when coalesce(p_consent_stored, consent_stored) then now() end,
      consent_helper    = coalesce(p_consent_helper, consent_helper),
      consent_helper_by = case when coalesce(p_consent_helper, consent_helper) then auth.uid() end,
      consent_helper_at = case when coalesce(p_consent_helper, consent_helper) then now() end,
      upload_path       = coalesce(p_upload_path, upload_path),
      upload_approved_by = case when p_upload_path is not null then auth.uid() else upload_approved_by end
    where student_id = sid;
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, student_id)
  values (auth.uid(), 'write', 'adhd_profiles', sid::text, sid);
  select version into v from public.adhd_profiles where student_id = sid;
  return v;
end $$;

-- PROJECTS AND PLANNING (PRD 6g) ------------------------------------------------------------------
create table public.planning_conversations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  question     text not null,
  answer       text,
  answered_by  text check (answered_by in ('student','coach')),
  asked_at     timestamptz not null default now(),
  answered_at  timestamptz
);
create index planning_conversations_project_idx on public.planning_conversations (project_id);
alter table public.planning_conversations enable row level security;
create policy planning_read on public.planning_conversations for select to authenticated using (public.can_read_student(student_id));

-- Plan history: every reschedule, who made it, and how to undo it. Written by server code.
-- The student can only mark a change as seen.
create table public.plan_changes (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  task_id          uuid references public.tasks(id) on delete set null,
  project_id       uuid references public.projects(id) on delete set null,
  kind             text not null,
  summary          text not null,
  made_by          text not null check (made_by in ('student','coach','helper')),
  made_by_user     uuid references public.profiles(id),
  reason           text,
  status           text not null default 'suggested' check (status in ('suggested','applied','undone')),
  before           jsonb,
  after            jsonb,
  shown_at         timestamptz,
  acknowledged_at  timestamptz,
  undone_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index plan_changes_student_idx on public.plan_changes (student_id, created_at desc);
alter table public.plan_changes enable row level security;
create policy plan_changes_read on public.plan_changes for select to authenticated using (public.can_read_student(student_id));
create policy plan_changes_ack on public.plan_changes for update to authenticated
  using (student_id = auth.uid() and public.app_role() = 'student') with check (student_id = auth.uid());
create trigger t1_guard before update on public.plan_changes for each row
  execute function public.guard_columns('{"student":{"update":["acknowledged_at"]}}');
create trigger t2_stamp before update on public.plan_changes for each row execute function public.stamp_time('acknowledged_at');

-- Morning walk-through: only whether she did it or skipped it. Never scored. Only she reads it.
create table public.walkthroughs (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  outcome     text not null check (outcome in ('did','skipped')),
  created_at  timestamptz not null default now(),
  unique (student_id, date)
);
alter table public.walkthroughs enable row level security;
create policy walkthroughs_own_read on public.walkthroughs for select to authenticated using (student_id = auth.uid());
create policy walkthroughs_own_insert on public.walkthroughs for insert to authenticated
  with check (student_id = auth.uid() and public.app_role() = 'student');

-- HELPER SETTINGS AND TUTOR ---------------------------------------------------------------------
create table public.helper_settings (
  student_id         uuid primary key references public.profiles(id) on delete cascade,
  autonomy           text not null default 'suggest_only' check (autonomy in ('suggest_only','small_moves','everything')),
  daily_call_budget  integer not null default 40 check (daily_call_budget between 0 and 500),
  chat_on            boolean not null default false,
  chat_consent       boolean not null default false,      -- recorded by a parent, never by anyone else
  chat_consent_by    uuid references public.profiles(id),
  chat_consent_at    timestamptz,
  updated_at         timestamptz not null default now()
);

create table public.tutor_settings (
  student_id      uuid primary key references public.profiles(id) on delete cascade,
  videos_on       boolean not null default false,
  consent_given   boolean not null default false,         -- recorded by a parent
  consent_by      uuid references public.profiles(id),
  consent_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create table public.tutor_conversations (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  thread_id   uuid not null default gen_random_uuid(),
  sender      text not null check (sender in ('student','tutor')),
  content     text not null,
  task_id     uuid references public.tasks(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index tutor_conversations_student_idx on public.tutor_conversations (student_id, created_at desc);

create table public.tutor_flags (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  pattern     text not null,
  hit_count   integer not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  status      text not null default 'open' check (status in ('open','seen','dismissed'))
);

alter table public.helper_settings      enable row level security;
alter table public.tutor_settings       enable row level security;
alter table public.tutor_conversations  enable row level security;
alter table public.tutor_flags          enable row level security;

create policy helper_settings_read on public.helper_settings for select to authenticated using (public.can_read_student(student_id));
create policy helper_settings_coach on public.helper_settings for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy helper_settings_parent on public.helper_settings for update to authenticated
  using (public.is_parent_of(student_id)) with check (public.is_parent_of(student_id));
create trigger t1_guard before insert or update on public.helper_settings for each row execute function public.guard_columns(
  '{"coach":{"insert":{"except":["chat_consent","chat_consent_by","chat_consent_at"]},"update":{"except":["chat_consent","chat_consent_by","chat_consent_at"]}},
    "parent":{"update":["chat_consent"]}}');
create trigger t2_stamp before insert or update on public.helper_settings for each row
  execute function public.stamp_consent('chat_consent','chat_consent_by','chat_consent_at');

create policy tutor_settings_read on public.tutor_settings for select to authenticated using (public.can_read_student(student_id));
create policy tutor_settings_coach on public.tutor_settings for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy tutor_settings_parent on public.tutor_settings for update to authenticated
  using (public.is_parent_of(student_id)) with check (public.is_parent_of(student_id));
create trigger t1_guard before insert or update on public.tutor_settings for each row execute function public.guard_columns(
  '{"coach":{"insert":{"except":["consent_given","consent_by","consent_at"]},"update":{"except":["consent_given","consent_by","consent_at"]}},
    "parent":{"update":["consent_given"]}}');
create trigger t2_stamp before insert or update on public.tutor_settings for each row
  execute function public.stamp_consent('consent_given','consent_by','consent_at');

-- Tutor conversations: the coach and the student's parent only (decided in the plan).
create policy tutor_conversations_read on public.tutor_conversations for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));
-- Flags are for the coach, shown as a pattern, never to the student.
create policy tutor_flags_read on public.tutor_flags for select to authenticated using (public.is_coach_of(student_id));
create policy tutor_flags_update on public.tutor_flags for update to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create trigger t1_guard before update on public.tutor_flags for each row
  execute function public.guard_columns('{"coach":{"update":["status"]}}');

create trigger t3_touch before update on public.helper_settings for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.tutor_settings  for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update on public.helper_settings for each row execute function public.audit_change();
create trigger t4_audit after insert or update on public.tutor_settings  for each row execute function public.audit_change();
