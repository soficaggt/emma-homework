-- Step 2, part 2: the homework itself.
-- Reading: the student, her parent and her coach. Writing is narrow; see each table.

-- Projects come first because tasks can belong to one.
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  source           text not null check (source in ('platform','email','coach','student')),
  due_date         date,
  size             text check (size in ('small','medium','large')),
  status           text not null default 'new' check (status in ('new','planning','planned','active','done','dropped')),
  sheet_text       text,
  sheet_image_path text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index projects_student_idx on public.projects (student_id);

-- The checklist.
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles(id) on delete cascade,
  date               date not null,                              -- the day she plans to do it
  original_date      date,                                       -- the day it was first planned; set once, so moving a task off its day can be seen
  title              text not null check (length(btrim(title)) between 1 and 200),
  note               text,
  minutes            integer check (minutes is null or minutes between 0 and 600),
  type               text not null default 'school' check (type in ('test','school','hunter','rsm','fixed','flex')),
  color_step         integer check (color_step is null or color_step between 0 and 30),  -- a step in the student's own color legend
  sort_order         integer not null default 0,
  done               boolean not null default false,
  done_at            timestamptz,
  proof_note         text,
  proof_photo_path   text,
  due_date           date,
  not_today          boolean not null default false,
  coins              integer not null default 0 check (coins between 0 and 6),  -- set by the server or an adult, never by the student
  deleted            boolean not null default false,
  -- where it came from
  source             text not null default 'student' check (source in ('student','coach','template','helper','platform')),
  source_platform    text,                                        -- rsm, schoology, pearson, hunter and so on
  external_id        text,                                        -- the platform's own ID, so a re-pull updates instead of duplicating
  proof_rule         text,
  verified_by        text check (verified_by in ('platform')),
  verified_at        timestamptz,
  verified_evidence  jsonb,
  -- ADHD supports
  first_step         text,
  start_plan         text,                                        -- her own if-then plan, in her words
  estimated_minutes  integer check (estimated_minutes is null or estimated_minutes between 0 and 600),
  actual_minutes     integer check (actual_minutes is null or actual_minutes between 0 and 1440),
  -- projects
  project_id         uuid references public.projects(id) on delete set null,
  project_step       integer,
  -- integrity (PRD 6f)
  reward_status      text not null default 'provisional' check (reward_status in ('provisional','confirmed','reversed')),
  review_status      text not null default 'unreviewed' check (review_status in ('unreviewed','looks_good','needs_more','not_done')),
  reviewed_by        uuid references public.profiles(id),
  reviewed_at        timestamptz,
  review_note        text,
  proof_questions    jsonb,
  proof_answers      jsonb,
  value_set_by       text check (value_set_by in ('template','coach','helper','platform','ai_intake','adult')),
  confirmed_at       timestamptz,
  final_at           timestamptz,                                 -- 24 hours after she finishes
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index tasks_student_date_idx on public.tasks (student_id, date);
create index tasks_project_idx on public.tasks (project_id);
create unique index tasks_external_key on public.tasks (student_id, source_platform, external_id) where external_id is not null;

create table public.template_items (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  weekdays     integer[] not null default '{}' check (weekdays <@ array[0,1,2,3,4,5,6]),  -- 0 = Sunday
  title        text not null,
  note         text,
  minutes      integer,
  type         text not null default 'school' check (type in ('test','school','hunter','rsm','fixed','flex')),
  color_step   integer,
  sort_order   integer not null default 0,
  due_in_days  integer not null default 0 check (due_in_days between 0 and 14),   -- 0 = due that night, 1 = due next morning
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index template_items_student_idx on public.template_items (student_id);

-- The Start button. Written by the server only, because the times feed the egg bonus and the "too fast" check.
create table public.work_sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  end_kind    text check (end_kind in ('finished','stopped'))
);
create index work_sessions_student_idx on public.work_sessions (student_id, started_at desc);
create index work_sessions_task_idx on public.work_sessions (task_id);

create table public.bring_home (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  label       text not null,
  packed      boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index bring_home_student_idx on public.bring_home (student_id, date);

create table public.student_settings (
  student_id        uuid primary key references public.profiles(id) on delete cascade,
  no_proof_types    text[] not null default '{flex,fixed}',
  no_alert_types    text[] not null default '{flex}',
  bring_home_rules  jsonb not null default '{}'::jsonb,
  proof_strictness  text not null default 'normal' check (proof_strictness in ('gentle','normal','strict')),
  updated_at        timestamptz not null default now()
);

-- Turn security on everywhere.
alter table public.projects         enable row level security;
alter table public.tasks            enable row level security;
alter table public.template_items   enable row level security;
alter table public.work_sessions    enable row level security;
alter table public.bring_home       enable row level security;
alter table public.student_settings enable row level security;

-- Reading: student, parent, coach.
create policy projects_read         on public.projects         for select to authenticated using (public.can_read_student(student_id));
create policy tasks_read            on public.tasks            for select to authenticated using (public.can_read_student(student_id));
create policy template_items_read   on public.template_items   for select to authenticated using (public.can_read_student(student_id));
create policy work_sessions_read    on public.work_sessions    for select to authenticated using (public.can_read_student(student_id));
create policy bring_home_read       on public.bring_home       for select to authenticated using (public.can_read_student(student_id));
create policy student_settings_read on public.student_settings for select to authenticated using (public.can_read_student(student_id));

-- Coach writes the plain configuration tables (projects, templates, settings, bring-home list).
create policy projects_coach_write on public.projects for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy template_items_coach_write on public.template_items for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy student_settings_coach_write on public.student_settings for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy bring_home_coach_write on public.bring_home for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
-- The student ticks her own bring-home list. Nothing else on it.
create policy bring_home_student_pack on public.bring_home for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create trigger t1_guard before update on public.bring_home for each row
  execute function public.guard_columns('{"coach":{"update":"all"},"student":{"update":["packed"]}}');

-- Tasks. A student may add a task for herself and edit its plain details while it is not done.
-- She can never set coins, done-state, source, type, proof or review fields, or verified status.
create policy tasks_student_insert on public.tasks for insert to authenticated
  with check (student_id = auth.uid() and public.app_role() = 'student' and source = 'student');
create policy tasks_student_update on public.tasks for update to authenticated
  using (student_id = auth.uid() and not done and public.app_role() = 'student')
  with check (student_id = auth.uid() and not done and (not deleted or source = 'student'));
-- A coach adds and edits tasks for her students, but only as a coach or template (never as "platform").
create policy tasks_coach_insert on public.tasks for insert to authenticated
  with check (public.is_coach_of(student_id) and source in ('coach','template')
              and (value_set_by is null or value_set_by in ('template','coach','adult')));
create policy tasks_coach_update on public.tasks for update to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));

create function public.tasks_rules() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.original_date := new.date; end if;
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' then
    -- Coins of a finished task are fixed. The due date a source set belongs to the source.
    if old.done and new.coins is distinct from old.coins then
      raise exception 'coins of a finished task cannot be changed' using errcode = '42501';
    end if;
    if public.app_role() = 'student' and old.source <> 'student' and new.due_date is distinct from old.due_date then
      raise exception 'the due date was set by its source' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger t1_guard before insert or update on public.tasks for each row execute function public.guard_columns(
  '{"student":{"insert":["student_id","date","title","note","due_date","minutes","color_step","sort_order","first_step","start_plan","estimated_minutes"],
                "update":["title","note","date","due_date","minutes","color_step","sort_order","not_today","deleted","first_step","start_plan","estimated_minutes"]},
    "coach":{"insert":{"except":["original_date","done","done_at","reward_status","confirmed_at","final_at","review_status","reviewed_by","reviewed_at","review_note","verified_by","verified_at","verified_evidence","proof_note","proof_photo_path","proof_answers","proof_questions","actual_minutes","external_id","source_platform"]},
             "update":{"except":["student_id","original_date","source","source_platform","external_id","done","done_at","reward_status","confirmed_at","final_at","review_status","reviewed_by","reviewed_at","review_note","verified_by","verified_at","verified_evidence","proof_note","proof_photo_path","proof_answers","proof_questions","actual_minutes"]}}}');
create trigger t2_rules before insert or update on public.tasks for each row execute function public.tasks_rules();
create trigger t3_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger t4_audit after update on public.tasks for each row execute function public.audit_change(
  'done,done_at,coins,reward_status,review_status,reviewed_by,reviewed_at,review_note,verified_by,verified_at,confirmed_at,final_at,value_set_by,deleted');

create trigger t3_touch before update on public.projects         for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.template_items   for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.bring_home       for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.student_settings for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update on public.student_settings for each row execute function public.audit_change();
