-- Step 2, part 3: rewards. Everything here that can be forged (coins, boxes, purchases) is written
-- only by server functions. The app can read its own rows and, for the shelf, reorder them.

-- One shared economy for every student. Only the developers change it (by migration). Read-only for everyone.
create table public.economy_config (
  key    text primary key,
  value  jsonb not null,
  note   text
);

-- The real squishy and slime items from the old Code.gs list. Only a coach edits it.
create table public.reward_catalog (
  id         text primary key,
  name       text not null,
  kind       text not null,        -- how it is drawn
  color      text,
  rarity     text not null check (rarity in ('common','uncommon','rare','legendary')),
  texture    text,
  price_usd  numeric(7,2) not null check (price_usd >= 0),
  cat        text not null check (cat in ('shelf','slime')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.collection (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  item_id       text not null,                  -- reward_catalog.id or catalog_items.id
  item_name     text not null,
  rarity        text,
  acquired_via  text not null check (acquired_via in ('box','shop','real_pick','gift')),
  box_date      date,
  shelf_pos     integer not null default 0,
  acquired_at   timestamptz not null default now(),
  unique (student_id, item_id)
);
create index collection_student_idx on public.collection (student_id);

-- Coin purchases and tickets (negative amounts for spending), held and confirmed earnings, reversals.
create table public.ledger (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('earn','egg','purchase','ticket','gift','reversal','forgiven')),
  amount       integer not null,
  status       text not null default 'held' check (status in ('held','confirmed','reversed','forgiven')),
  task_id      uuid references public.tasks(id) on delete set null,
  reverses_id  uuid references public.ledger(id),   -- a reversal points at the entry it undoes
  note         text,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz
);
create index ledger_student_idx on public.ledger (student_id, created_at desc);
create index ledger_task_idx on public.ledger (task_id);

-- One row per student per day: box earned, full or mini, sparkle, opened.
create table public.day_results (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles(id) on delete cascade,
  date            date not null,
  box_earned      boolean not null default false,
  box_kind        text check (box_kind in ('full','mini')),
  sparkle         boolean not null default false,
  opened          boolean not null default false,
  opened_at       timestamptz,
  box_item_id     text,
  moved_task_ids  uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (student_id, date)
);

-- This week's shop for each student, fixed for the week.
create table public.shop_weeks (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  week_start  date not null,
  item_ids    text[] not null,
  created_at  timestamptz not null default now(),
  unique (student_id, week_start)
);

alter table public.economy_config  enable row level security;
alter table public.reward_catalog  enable row level security;
alter table public.collection      enable row level security;
alter table public.ledger          enable row level security;
alter table public.day_results     enable row level security;
alter table public.shop_weeks      enable row level security;

create policy economy_read on public.economy_config for select to authenticated using (true);

-- Catalog: a coach edits all of it. A student sees only items she already owns.
create policy reward_catalog_coach on public.reward_catalog for all to authenticated
  using (public.app_role() = 'coach') with check (public.app_role() = 'coach');
create policy reward_catalog_owner_read on public.reward_catalog for select to authenticated
  using (exists (select 1 from public.collection c where c.item_id = reward_catalog.id and c.student_id = auth.uid()));

create policy collection_read   on public.collection  for select to authenticated using (public.can_read_student(student_id));
create policy ledger_read       on public.ledger      for select to authenticated using (public.can_read_student(student_id));
create policy day_results_read  on public.day_results for select to authenticated using (public.can_read_student(student_id));
create policy shop_weeks_read   on public.shop_weeks  for select to authenticated using (public.can_read_student(student_id));

-- The only thing a student can write here: the order of her own shelf.
create policy collection_student_reorder on public.collection for update to authenticated
  using (student_id = auth.uid() and public.app_role() = 'student')
  with check (student_id = auth.uid());
create trigger t1_guard before update on public.collection for each row
  execute function public.guard_columns('{"student":{"update":["shelf_pos"]}}');

create trigger t4_audit after insert or update on public.collection  for each row execute function public.audit_change();
create trigger t4_audit after insert or update on public.ledger      for each row execute function public.audit_change();
create trigger t4_audit after insert or update on public.day_results for each row execute function public.audit_change();
create trigger t4_audit after insert or update or delete on public.reward_catalog for each row execute function public.audit_change();
