-- Step 2, part 4: alerts, and per-student themes and reward packs.

-- ALERTS ---------------------------------------------------------------------------------------
-- Every alert is a row. Created by server code; the recipient can only mark it read.
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  student_id    uuid references public.profiles(id) on delete cascade,
  kind          text not null,
  body          text not null,
  task_id       uuid references public.tasks(id) on delete set null,
  photo_path    text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.notification_prefs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  channel    text not null check (channel in ('in_app','push')),   -- text and email can be added later
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, kind, channel)
);

create table public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null unique,
  platform    text not null default 'ios',
  created_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.notifications      enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_tokens        enable row level security;

create policy notifications_read on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create trigger t1_guard before update on public.notifications for each row execute function public.guard_columns(
  '{"student":{"update":["read_at"]},"parent":{"update":["read_at"]},"coach":{"update":["read_at"]}}');
create trigger t2_stamp before update on public.notifications for each row execute function public.stamp_time('read_at');

create policy prefs_own on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger t3_touch before update on public.notification_prefs for each row execute function public.touch_updated_at();

create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- THEMES AND REWARD PACKS ----------------------------------------------------------------------
-- A theme is per student, or a template (student_id null) that a coach reuses.
create table public.themes (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references public.profiles(id) on delete cascade,
  created_by     uuid references public.profiles(id),
  name           text not null,
  is_template    boolean generated always as (student_id is null) stored,
  page_names     jsonb not null default '{}'::jsonb,
  icons          jsonb not null default '{}'::jsonb,
  palette        jsonb not null default '{}'::jsonb,
  fonts          jsonb not null default '{}'::jsonb,
  shapes         jsonb not null default '{}'::jsonb,
  mascot         jsonb not null default '{}'::jsonb,
  celebration    jsonb not null default '{}'::jsonb,
  wording        jsonb not null default '{}'::jsonb,
  currency       jsonb not null default '{}'::jsonb,
  theming_depth  text not null default 'rewards_only' check (theming_depth in ('rewards_only','light','medium','whole_app')),
  -- {"mode": "urgency_ladder|by_subject|by_type|none", "steps": [{"color":..., "name":..., "meaning":...}, ...]}
  color_system   jsonb not null default '{"mode":"none","steps":[]}'::jsonb,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, student_id)
);
create index themes_student_idx on public.themes (student_id);

-- What is collected and how it looks. The economy numbers are NOT here: they are shared (economy_config).
create table public.reward_packs (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles(id) on delete cascade,
  collect_name       text not null default 'collection',
  digital_on         boolean not null default true,
  real_on            boolean not null default false,
  rarity_names       jsonb not null default '{"common":"common","uncommon":"uncommon","rare":"rare","legendary":"legendary"}'::jsonb,
  art_style          text,
  item_sources       jsonb not null default '[]'::jsonb,
  currency_skin      jsonb not null default '{"name":"coins","look":"gold"}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, student_id)
);
create index reward_packs_student_idx on public.reward_packs (student_id);

create table public.catalog_items (
  id               uuid primary key default gen_random_uuid(),
  pack_id          uuid not null,
  student_id       uuid not null,
  name             text not null,
  image_ref        text,
  price_usd        numeric(8,2) check (price_usd is null or price_usd >= 0),
  link             text,
  link_gated       boolean not null default true,       -- links out are behind the parent gate
  tags             text[] not null default '{}',
  rarity           text check (rarity in ('common','uncommon','rare','legendary')),
  source           text not null check (source in ('hand_made','pasted_wishlist','web_search','connected_account')),
  status           text not null default 'proposed' check (status in ('proposed','approved')),
  retailer         text,
  purchase_method  text not null default 'link_only' check (purchase_method in ('link_only','prefilled_cart','automatic_order')),
  approved_by      uuid references public.profiles(id),
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (pack_id, student_id) references public.reward_packs (id, student_id) on delete cascade
);
create index catalog_items_student_idx on public.catalog_items (student_id, status);

-- The saved interview answers, so the Helper can rebuild a theme and pack when interests change.
create table public.student_setup (
  student_id  uuid primary key references public.profiles(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- The three helpers have fixed jobs. Their names and looks are theme data.
create table public.helper_characters (
  id          uuid primary key default gen_random_uuid(),
  theme_id    uuid not null,
  student_id  uuid,
  job         text not null check (job in ('planner','tutor','checker')),
  name        text not null,
  art_ref     text,
  unique (theme_id, job),
  foreign key (theme_id, student_id) references public.themes (id, student_id) on delete cascade
);

alter table public.themes            enable row level security;
alter table public.reward_packs      enable row level security;
alter table public.catalog_items     enable row level security;
alter table public.student_setup     enable row level security;
alter table public.helper_characters enable row level security;

-- Themes: the student, her parent and her coach read hers. Only a coach writes. Templates belong to their coach.
create policy themes_read on public.themes for select to authenticated
  using ((student_id is not null and public.can_read_student(student_id))
      or (student_id is null and created_by = auth.uid()));
create policy themes_coach on public.themes for all to authenticated
  using ((student_id is not null and public.is_coach_of(student_id))
      or (student_id is null and created_by = auth.uid() and public.app_role() = 'coach'))
  with check ((student_id is not null and public.is_coach_of(student_id))
      or (student_id is null and created_by = auth.uid() and public.app_role() = 'coach'));

create policy reward_packs_read on public.reward_packs for select to authenticated using (public.can_read_student(student_id));
create policy reward_packs_coach on public.reward_packs for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));

-- Items: the student sees only approved items. Parent and coach see all. Only a coach approves.
create policy catalog_items_read on public.catalog_items for select to authenticated
  using ((student_id = auth.uid() and status = 'approved') or public.is_coach_of(student_id) or public.is_parent_of(student_id));
create policy catalog_items_coach on public.catalog_items for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));

create policy student_setup_read on public.student_setup for select to authenticated using (public.can_read_student(student_id));
create policy student_setup_coach on public.student_setup for all to authenticated
  using (public.is_coach_of(student_id)) with check (public.is_coach_of(student_id));

create policy helper_characters_read on public.helper_characters for select to authenticated
  using (student_id is not null and public.can_read_student(student_id));
create policy helper_characters_coach on public.helper_characters for all to authenticated
  using (student_id is not null and public.is_coach_of(student_id))
  with check (student_id is not null and public.is_coach_of(student_id));

-- Approval records the real approver and time; the app cannot choose them.
create function public.stamp_catalog_approval() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
      new.approved_by := auth.uid(); new.approved_at := now();
    elsif new.status <> 'approved' then
      new.approved_by := null; new.approved_at := null;
    elsif tg_op = 'UPDATE' then
      new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    end if;
  end if;
  return new;
end $$;
create trigger t2_stamp before insert or update on public.catalog_items for each row execute function public.stamp_catalog_approval();

create trigger t3_touch before update on public.themes        for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.reward_packs  for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.catalog_items for each row execute function public.touch_updated_at();
create trigger t3_touch before update on public.student_setup for each row execute function public.touch_updated_at();
create trigger t4_audit after insert or update or delete on public.themes        for each row execute function public.audit_change('name,theming_depth,color_system,active');
create trigger t4_audit after insert or update or delete on public.catalog_items for each row execute function public.audit_change('status,approved_by,price_usd,purchase_method,retailer');
