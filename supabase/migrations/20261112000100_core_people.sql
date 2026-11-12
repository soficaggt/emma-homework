-- Step 2, part 1: lock-down defaults, people, who-is-linked-to-whom, and the shared safety helpers.
-- Everything in this schema is private by default. Access is added table by table below.

-- 1. Nothing created in the public schema from now on is open to the app by accident.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- 2. People. One row per login (Supabase Auth). Created only by server code when an adult invites someone.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('coach','student','parent')),
  first_name  text not null check (length(btrim(first_name)) between 1 and 40),
  username    text check (username ~ '^[a-z0-9_]{3,30}$'),
  time_zone   text not null default 'America/New_York',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (username) where username is not null;
alter table public.profiles enable row level security;

-- Which coach coaches which student, and which parent belongs to which student.
create table public.student_links (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  adult_id    uuid not null references public.profiles(id) on delete cascade,
  relation    text not null check (relation in ('coach','parent')),
  created_at  timestamptz not null default now(),
  unique (student_id, adult_id, relation)
);
create index student_links_adult_idx on public.student_links (adult_id, relation);
alter table public.student_links enable row level security;

-- A link must join a real student to an adult whose role matches the relation.
create function public.validate_student_link() returns trigger
language plpgsql set search_path = public as $$
declare s text; a text;
begin
  select role into s from profiles where id = new.student_id;
  select role into a from profiles where id = new.adult_id;
  if s is distinct from 'student' then raise exception 'student_id must be a student'; end if;
  if a is distinct from new.relation then raise exception 'adult role must match the relation'; end if;
  return new;
end $$;
create trigger t1_validate before insert or update on public.student_links
  for each row execute function public.validate_student_link();

-- 3. Audit log (append-only; nobody in the app can write it).
create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  action      text not null,
  table_name  text,
  row_id      text,
  student_id  uuid,
  details     jsonb not null default '{}'::jsonb
);
create index audit_log_student_idx on public.audit_log (student_id, at desc);
alter table public.audit_log enable row level security;

-- 4. Who-is-who helpers. They run with the table owner's rights so policies can use them
-- without recursion. They only ever answer about the signed-in user (auth.uid()).
create function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_coach_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_links
                 where student_id = sid and adult_id = auth.uid() and relation = 'coach')
$$;

create function public.is_parent_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_links
                 where student_id = sid and adult_id = auth.uid() and relation = 'parent')
$$;

-- The student herself, her coach, or her parent.
create function public.can_read_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = sid or public.is_coach_of(sid) or public.is_parent_of(sid)
$$;

-- May this signed-in person see this profile? Self, her own adults, or a student's adults who share a child.
create function public.visible_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select pid = auth.uid()
      or exists (select 1 from public.student_links l
                 where (l.student_id = pid and l.adult_id = auth.uid())
                    or (l.adult_id = pid and l.student_id = auth.uid())
                    or (l.adult_id = pid and exists (select 1 from public.student_links m
                          where m.student_id = l.student_id and m.adult_id = auth.uid()))
                    or (l.student_id = pid and exists (select 1 from public.student_links m
                          where m.student_id = l.student_id and m.adult_id = auth.uid())))
$$;

-- 5. Shared triggers.

-- Which columns each kind of signed-in person may set. Configured per table as JSON:
--   {"student": {"insert": [...], "update": [...]}, "parent": {...}, "coach": {"update": {"except": [...]}}}
-- A list means "only these columns", {"except": [...]} means "everything but these", "all" means anything.
-- A role or operation that is not listed is refused. On insert, a column that is not allowed must
-- equal its default, so a student cannot start a row with coins or a verified flag already on it.
-- Server functions and migrations run as a different database user, so they are not limited here.
create function public.guard_columns() returns trigger
language plpgsql set search_path = public as $$
declare
  rules jsonb := tg_argv[0]::jsonb;
  who text;
  spec jsonb;
  op text := lower(tg_op);
  newj jsonb := to_jsonb(new);
  oldj jsonb;
  only_mode boolean;
  lst text[];
  k text;
  expr text;
  dflt jsonb;
  blocked boolean;
begin
  if current_user <> 'authenticated' then return new; end if;
  who := public.app_role();
  spec := rules -> coalesce(who, 'none') -> op;
  if spec is null then
    raise exception 'not allowed to % %', op, tg_table_name using errcode = '42501';
  end if;
  if spec = '"all"'::jsonb then return new; end if;

  only_mode := jsonb_typeof(spec) = 'array';
  select coalesce(array_agg(x), '{}') into lst
    from jsonb_array_elements_text(case when only_mode then spec else coalesce(spec -> 'except', '[]'::jsonb) end) x;

  if op = 'update' then
    oldj := to_jsonb(old);
    for k in select key from jsonb_each(newj) loop
      if newj -> k is distinct from oldj -> k then
        blocked := case when only_mode then not (k = any (lst)) else (k = any (lst)) end;
        if blocked then
          raise exception 'column % of % cannot be changed by you', k, tg_table_name using errcode = '42501';
        end if;
      end if;
    end loop;
  else
    for k in select key from jsonb_each(newj) loop
      continue when k in ('id', 'created_at', 'updated_at');
      blocked := case when only_mode then not (k = any (lst)) else (k = any (lst)) end;
      if blocked then
        select pg_get_expr(d.adbin, d.adrelid) into expr
          from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
         where d.adrelid = tg_relid and a.attname = k;
        if expr is null then dflt := 'null'::jsonb;
        else execute format('select to_jsonb(%s)', expr) into dflt;
        end if;
        if newj -> k is distinct from dflt then
          raise exception 'column % of % cannot be set by you', k, tg_table_name using errcode = '42501';
        end if;
      end if;
    end loop;
  end if;
  return new;
end $$;

-- A "when did this happen" column that the app may set once, and only to the real time.
create function public.stamp_time() returns trigger
language plpgsql set search_path = public as $$
declare col text := tg_argv[0]; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
begin
  if current_user <> 'authenticated' then return new; end if;
  if n -> col is distinct from o -> col then
    if o -> col <> 'null'::jsonb then
      new := jsonb_populate_record(new, jsonb_build_object(col, o -> col));
    else
      new := jsonb_populate_record(new, jsonb_build_object(col, to_jsonb(now())));
    end if;
  end if;
  return new;
end $$;

-- A consent flag records who agreed and when, automatically. The app cannot write the who or when.
create function public.stamp_consent() returns trigger
language plpgsql set search_path = public as $$
declare flag text := tg_argv[0]; by_col text := tg_argv[1]; at_col text := tg_argv[2];
        n jsonb := to_jsonb(new); changed boolean; on_now boolean;
begin
  if current_user <> 'authenticated' then return new; end if;
  on_now := coalesce((n ->> flag)::boolean, false);
  if tg_op = 'INSERT' then changed := on_now;
  else changed := (n -> flag) is distinct from (to_jsonb(old) -> flag);
  end if;
  if changed then
    new := jsonb_populate_record(new, jsonb_build_object(
      by_col, case when on_now then to_jsonb(auth.uid()) else 'null'::jsonb end,
      at_col, case when on_now then to_jsonb(now()) else 'null'::jsonb end));
  end if;
  return new;
end $$;

-- Records who changed a setting and when (the person who last edited a settings row).
create function public.stamp_editor() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new := jsonb_populate_record(new, jsonb_build_object('set_by', to_jsonb(auth.uid()), 'set_at', to_jsonb(now())));
  end if;
  return new;
end $$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Writes a line in the audit log for changes to sensitive tables.
-- Optional argument: a comma-separated list of columns; then an update is logged only if one of them changed.
create function public.audit_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  watch text[] := case when tg_nargs > 0 then string_to_array(tg_argv[0], ',') end;
  n jsonb; o jsonb; diff jsonb; src jsonb; k text;
begin
  if tg_op = 'DELETE' then src := to_jsonb(old); n := null; o := src;
  else src := to_jsonb(new); n := src; o := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  end if;
  src := src - 'key_hash';

  if tg_op = 'UPDATE' then
    diff := '{}'::jsonb;
    for k in select key from jsonb_each(n) loop
      if k in ('updated_at', 'key_hash') then continue; end if;
      if n -> k is distinct from o -> k and (watch is null or k = any (watch)) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('old', o -> k, 'new', n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return null; end if;
  else
    diff := src;   -- inserts and deletes are always logged in full
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, student_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(src ->> 'id', src ->> 'student_id'),
          nullif(src ->> 'student_id', '')::uuid,
          diff);
  return null;
end $$;

-- 6. Policies for the people tables.
create policy profiles_read on public.profiles for select to authenticated
  using (public.visible_profile(id));
-- A coach edits her students; an adult edits herself. A student cannot edit her own profile
-- (her time zone decides where one day ends, so she must not move it).
create policy profiles_update on public.profiles for update to authenticated
  using ((id = auth.uid() and public.app_role() <> 'student') or public.is_coach_of(id))
  with check ((id = auth.uid() and public.app_role() <> 'student') or public.is_coach_of(id));
create trigger t1_guard before update on public.profiles for each row
  execute function public.guard_columns('{"coach":{"update":["first_name","time_zone"]},"parent":{"update":["first_name","time_zone"]}}');
create trigger t3_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Links are created by server code only; people can see the links they are part of.
create policy links_read on public.student_links for select to authenticated
  using (adult_id = auth.uid() or student_id = auth.uid() or public.is_coach_of(student_id));
create trigger t4_audit after insert or update or delete on public.student_links
  for each row execute function public.audit_change();

-- The audit log is readable only by a student's coach.
create policy audit_read on public.audit_log for select to authenticated
  using (student_id is not null and public.is_coach_of(student_id));
