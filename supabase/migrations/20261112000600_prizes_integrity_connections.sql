-- Step 2, part 6: real prizes, integrity records, and connections to other platforms.

-- REAL PRIZES (PRD 6j) -------------------------------------------------------------------------
-- No card number and no address are stored anywhere. A parent sets the budget and how things get bought.
create table public.prize_settings (
  student_id            uuid primary key references public.profiles(id) on delete cascade,
  weekly_budget_cents   integer not null default 4000 check (weekly_budget_cents between 0 and 100000),
  buying_method         text not null default 'alert_only' check (buying_method in ('alert_only','one_tap','automatic')),
  allow_over_budget     boolean not null default false,       -- the budget is a hard cap unless a parent says otherwise
  cancel_delay_minutes  integer not null default 120 check (cancel_delay_minutes between 0 and 10080),
  set_by                uuid references public.profiles(id),
  set_at                timestamptz,
  updated_at            timestamptz not null default now()
);

-- Written by the server only. Only the server places an order, for an earned and confirmed week,
-- within the cap, after the cancel delay, for an approved item.
create table public.prize_orders (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.profiles(id) on delete cascade,
  week_start           date not null,
  catalog_item_id      uuid references public.catalog_items(id) on delete set null,
  item_name            text not null,
  price_cents          integer not null check (price_cents >= 0),      -- including shipping and tax
  retailer             text,
  status               text not null default 'suggested'
                         check (status in ('suggested','awaiting_parent','placed','cancelled','shipped','delivered','failed')),
  placed_at            timestamptz,
  cancel_until         timestamptz,
  retailer_order_ref   text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index prize_orders_student_idx on public.prize_orders (student_id, week_start);

alter table public.prize_settings enable row level security;
alter table public.prize_orders   enable row level security;

-- Her parent and her coach read and edit the settings. The student can neither read nor write them.
create policy prize_settings_read on public.prize_settings for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));
create policy prize_settings_write on public.prize_settings for all to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id))
  with check (public.is_coach_of(student_id) or public.is_parent_of(student_id));
create trigger t1_guard before insert or update on public.prize_settings for each row execute function public.guard_columns(
  '{"coach":{"insert":{"except":["set_by","set_at"]},"update":{"except":["student_id","set_by","set_at"]}},
    "parent":{"insert":{"except":["set_by","set_at"]},"update":{"except":["student_id","set_by","set_at"]}}}');
create trigger t2_stamp before insert or update on public.prize_settings for each row execute function public.stamp_editor();
create trigger t3_touch before update on public.prize_settings for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update on public.prize_settings for each row execute function public.audit_change();

create policy prize_orders_read on public.prize_orders for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));
create trigger t3_touch before update on public.prize_orders for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update on public.prize_orders for each row execute function public.audit_change();

-- INTEGRITY (PRD 6f) ---------------------------------------------------------------------------
create table public.proof_checks (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('rules','ai')),
  result      text not null check (result in ('pass','needs_more','unclear')),
  reason      text,
  created_at  timestamptz not null default now()
);
create index proof_checks_task_idx on public.proof_checks (task_id);

create table public.task_intake (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.profiles(id) on delete cascade,
  task_id             uuid references public.tasks(id) on delete set null,
  typed_name          text not null,
  matched_to          jsonb,
  questions           jsonb,
  answers             jsonb,
  ai_verdict          text,
  priority_step       integer,
  size                text check (size in ('small','medium','large')),
  unverified_claims   jsonb not null default '[]'::jsonb,   -- claims that would raise the value, until confirmed
  waiting_for_adult   boolean not null default false,
  decided_by          uuid references public.profiles(id),
  decided_at          timestamptz,
  answers_purge_at    timestamptz,                          -- how long answers are kept is still to be confirmed
  created_at          timestamptz not null default now()
);
create index task_intake_student_idx on public.task_intake (student_id);

create table public.proof_images (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  storage_path  text not null,
  sha256        text,
  phash         text,
  origin        text check (origin in ('camera','library','screenshot')),
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);
create index proof_images_hash_idx on public.proof_images (student_id, sha256);

create table public.integrity_flags (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  task_id     uuid references public.tasks(id) on delete set null,
  kind        text not null check (kind in ('implausible_title','too_fast','duplicate','reused_text','reused_photo','many_self_added','other')),
  status      text not null default 'open' check (status in ('open','seen','dismissed')),
  seen_by     uuid[] not null default '{}',
  detail      text,
  created_at  timestamptz not null default now()
);
create index integrity_flags_student_idx on public.integrity_flags (student_id, status);

alter table public.proof_checks     enable row level security;
alter table public.task_intake      enable row level security;
alter table public.proof_images     enable row level security;
alter table public.integrity_flags  enable row level security;

-- Parent and coach read all of these. The student reads only her own intake (she needs to see "Sofia will look at this").
-- Nobody in the app writes them: the checker and planner functions do, with the server key.
create policy proof_checks_read on public.proof_checks for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));
create policy task_intake_read on public.task_intake for select to authenticated using (public.can_read_student(student_id));
create policy proof_images_read on public.proof_images for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));
create policy integrity_flags_read on public.integrity_flags for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));

-- CONNECTIONS (PRD 6a, 6d) ---------------------------------------------------------------------
create table public.connections (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  platform         text not null,
  tier             text not null check (tier in ('feed','email','browser','manual')),
  status           text not null default 'paused' check (status in ('working','needs_reconnect','paused')),
  parent_consent   boolean not null default false,     -- recorded by a parent
  consent_by       uuid references public.profiles(id),
  consent_at       timestamptz,
  last_run_at      timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (student_id, platform)
);

-- Each student's private address for forwarded homework. Parent and coach can read it; only the server writes it.
create table public.inbound_addresses (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null unique references public.profiles(id) on delete cascade,
  address     text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.connections       enable row level security;
alter table public.inbound_addresses enable row level security;

create policy connections_read on public.connections for select to authenticated using (public.can_read_student(student_id));
create policy connections_coach on public.connections for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create policy connections_parent on public.connections for update to authenticated
  using (public.is_parent_of(student_id)) with check (public.is_parent_of(student_id));
create trigger t1_guard before insert or update on public.connections for each row execute function public.guard_columns(
  '{"coach":{"insert":{"except":["parent_consent","consent_by","consent_at"]},"update":{"except":["student_id","parent_consent","consent_by","consent_at"]}},
    "parent":{"update":["parent_consent"]}}');
create trigger t2_stamp before insert or update on public.connections for each row
  execute function public.stamp_consent('parent_consent','consent_by','consent_at');
create trigger t3_touch before update on public.connections for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update or delete on public.connections for each row execute function public.audit_change();

create policy inbound_addresses_read on public.inbound_addresses for select to authenticated
  using (public.is_coach_of(student_id) or public.is_parent_of(student_id));

-- Integrity flags: a coach can mark one seen or dismissed.
create policy integrity_flags_coach_update on public.integrity_flags for update to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));
create trigger t1_guard before update on public.integrity_flags for each row
  execute function public.guard_columns('{"coach":{"update":["status","seen_by"]}}');
