-- Step 3: logins.
-- 1. Coach powers need the two-factor step (an authenticator code), not just a password.
-- 2. Invites, recovery emails, sign-in attempts and reset links: four tables that only server code
--    can reach (no grants and no policies for the app at all).
-- 3. The server-only functions the login Edge Functions call. Each one checks who is acting itself,
--    because the server key is not limited by row security.

---------------------------------------------------------------------------------------------------
-- 1. TWO-FACTOR FOR COACHES
---------------------------------------------------------------------------------------------------
-- How strongly this session was signed in. Supabase puts 'aal1' (password) or 'aal2' (password plus
-- authenticator code) in every login token.
create function public.session_aal() returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1')
$$;

-- A coach who has not done the authenticator step has no role at all, so every rule that checks
-- for a coach (or for any role) refuses her until she does.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select case when p.role = 'coach' and public.session_aal() <> 'aal2' then null else p.role end
    from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_coach_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.session_aal() = 'aal2'
     and exists (select 1 from public.student_links
                 where student_id = sid and adult_id = auth.uid() and relation = 'coach')
$$;

-- Same as before, except a coach without the authenticator step sees only herself.
create or replace function public.visible_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select pid = auth.uid()
      or (public.app_role() is not null
          and exists (select 1 from public.student_links l
                 where (l.student_id = pid and l.adult_id = auth.uid())
                    or (l.adult_id = pid and l.student_id = auth.uid())
                    or (l.adult_id = pid and exists (select 1 from public.student_links m
                          where m.student_id = l.student_id and m.adult_id = auth.uid()))
                    or (l.student_id = pid and exists (select 1 from public.student_links m
                          where m.student_id = l.student_id and m.adult_id = auth.uid()))))
$$;

drop policy links_read on public.student_links;
create policy links_read on public.student_links for select to authenticated
  using ((adult_id = auth.uid() and public.app_role() is not null)
         or student_id = auth.uid() or public.is_coach_of(student_id));

grant execute on function public.session_aal() to authenticated;

---------------------------------------------------------------------------------------------------
-- 2. SERVER-ONLY TABLES
---------------------------------------------------------------------------------------------------
-- A one-time invite. Only a scrambled copy (hash) of the code is kept, so a database read cannot
-- reveal a usable code.
create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  code_hash     text not null unique,
  role          text not null check (role in ('coach','student','parent')),
  first_name    text not null check (length(btrim(first_name)) between 1 and 40),
  student_id    uuid references public.profiles(id) on delete cascade,   -- parent invites: whose parent
  created_by    uuid references public.profiles(id) on delete set null,  -- null: made by the developer script
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  used_by       uuid references public.profiles(id) on delete set null,
  cancelled_at  timestamptz,
  check ((role = 'parent') = (student_id is not null))
);
create index invites_creator_idx on public.invites (created_by, created_at desc);

-- The email a reset link is sent to. For a student this can be her own or a grown-up's.
-- Never shown in full to anyone in the app.
create table public.account_contacts (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  recovery_email  text not null check (length(recovery_email) <= 254
                                       and recovery_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  updated_at      timestamptz not null default now()
);

-- Sign-in, invite-code and forgot-password attempts, for the lockout and the rate limits.
create table public.auth_attempts (
  id    bigint generated always as identity primary key,
  kind  text not null check (kind in ('sign_in','invite','forgot')),
  key   text not null,          -- the username tried ('-' when there is none)
  ip    text,
  ok    boolean not null,
  at    timestamptz not null default now()
);
create index auth_attempts_key_idx on public.auth_attempts (kind, key, at desc);
create index auth_attempts_ip_idx  on public.auth_attempts (kind, ip, at desc);

-- One-time password reset links (hash only). They last one hour.
create table public.reset_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  token_hash    text not null unique,
  requested_by  uuid references public.profiles(id) on delete set null,   -- null: she asked herself
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz
);
create index reset_tokens_user_idx on public.reset_tokens (user_id, created_at desc);

alter table public.invites          enable row level security;
alter table public.account_contacts enable row level security;
alter table public.auth_attempts    enable row level security;
alter table public.reset_tokens     enable row level security;
revoke all on public.invites, public.account_contacts, public.auth_attempts, public.reset_tokens
  from public, anon, authenticated;

---------------------------------------------------------------------------------------------------
-- 3. SERVER-ONLY FUNCTIONS (called by the login Edge Functions with the server key)
---------------------------------------------------------------------------------------------------
-- Is this person the actor, or someone the actor looks after?
-- Coach: her students and her students' parents. Parent: their own child. Anyone: themselves.
create function public.account_can_manage(p_actor uuid, p_target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_actor = p_target
      or exists (select 1 from student_links where student_id = p_target and adult_id = p_actor)
      or exists (select 1 from student_links c join student_links p on p.student_id = c.student_id
                  where c.adult_id = p_actor and c.relation = 'coach'
                    and p.adult_id = p_target and p.relation = 'parent')
$$;

-- Make an invite. A coach invites students and parents of her own students. A coach invite can
-- only be made without an actor, which means the developer script (it has no app path).
create function public.account_invite_create(
  p_actor uuid, p_role text, p_first_name text, p_student uuid, p_code_hash text, p_days integer default 7)
returns table (id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if p_days not between 1 and 14 then raise exception 'bad_days'; end if;
  if p_actor is null then
    if p_role <> 'coach' then raise exception 'not_allowed' using errcode = '42501'; end if;
  else
    select role into who from profiles where profiles.id = p_actor;
    if who is distinct from 'coach' or p_role not in ('student','parent') then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if p_role = 'parent' and not exists (select 1 from student_links
         where student_id = p_student and adult_id = p_actor and relation = 'coach') then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  return query
  insert into invites as i (code_hash, role, first_name, student_id, created_by, expires_at)
  values (p_code_hash, p_role, btrim(p_first_name), case when p_role = 'parent' then p_student end,
          p_actor, now() + make_interval(days => p_days))
  returning i.id, i.expires_at;
  insert into audit_log (actor_id, action, table_name, row_id, student_id, details)
  select p_actor, 'invite_create', 'invites', x.id::text, x.student_id,
         jsonb_build_object('role', x.role, 'first_name', x.first_name, 'expires_at', x.expires_at)
    from invites x where x.code_hash = p_code_hash;
end $$;

-- Look at an invite before using it (to greet the person by first name).
create function public.account_invite_peek(p_code_hash text)
returns table (first_name text, role text)
language sql stable security definer set search_path = public as $$
  select i.first_name, i.role from invites i
   where i.code_hash = p_code_hash and i.used_at is null and i.cancelled_at is null and i.expires_at > now()
$$;

-- Use an invite: the Auth user was just made by the Edge Function with the password she chose.
-- This makes the profile, the links and a new student's starting rows, all at once or not at all.
create function public.account_invite_finish(p_code_hash text, p_user uuid, p_username text, p_email text)
returns table (role text, first_name text)
language plpgsql security definer set search_path = public as $$
declare inv invites; new_theme uuid;
begin
  select * into inv from invites i where i.code_hash = p_code_hash for update;
  if not found or inv.used_at is not null or inv.cancelled_at is not null or inv.expires_at <= now() then
    raise exception 'invite_not_valid';
  end if;
  insert into profiles (id, role, first_name, username) values (p_user, inv.role, inv.first_name, p_username);
  insert into account_contacts (user_id, recovery_email) values (p_user, lower(btrim(p_email)));
  if inv.role = 'student' then
    if inv.created_by is not null then
      insert into student_links (student_id, adult_id, relation) values (p_user, inv.created_by, 'coach');
    end if;
    insert into student_settings (student_id) values (p_user);
    insert into helper_settings  (student_id) values (p_user);
    insert into tutor_settings   (student_id) values (p_user);
    insert into prize_settings   (student_id) values (p_user);
    insert into reward_packs     (student_id) values (p_user);
    insert into themes (student_id, created_by, name) values (p_user, inv.created_by, 'Starter') returning id into new_theme;
  elsif inv.role = 'parent' then
    insert into student_links (student_id, adult_id, relation) values (inv.student_id, p_user, 'parent');
  end if;
  update invites set used_at = now(), used_by = p_user where id = inv.id;
  insert into audit_log (actor_id, action, table_name, row_id, student_id, details)
  values (p_user, 'invite_used', 'invites', inv.id::text,
          case when inv.role = 'student' then p_user else inv.student_id end,
          jsonb_build_object('role', inv.role, 'username', p_username));
  return query select inv.role, inv.first_name;
end $$;

-- The invites a coach made that are still waiting to be used.
create function public.account_invite_list(p_actor uuid)
returns table (id uuid, role text, first_name text, student_id uuid, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.role, i.first_name, i.student_id, i.created_at, i.expires_at from invites i
   where i.created_by = p_actor and i.used_at is null and i.cancelled_at is null and i.expires_at > now()
   order by i.created_at desc
$$;

create function public.account_invite_cancel(p_actor uuid, p_invite uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  update invites set cancelled_at = now()
   where id = p_invite and created_by = p_actor and used_at is null and cancelled_at is null
   returning student_id into sid;
  if not found then return false; end if;
  insert into audit_log (actor_id, action, table_name, row_id, student_id)
  values (p_actor, 'invite_cancel', 'invites', p_invite::text, sid);
  return true;
end $$;

-- Lockout: 5 wrong passwords for one username within 15 minutes (since its last good sign-in)
-- locks that username for 15 minutes. 20 failures from one network address within 15 minutes
-- pauses that address. Invite-code tries have no username ('-'), so only the address counts for them.
-- The same answer is given whether or not the username exists.
create function public.auth_attempt_blocked(p_kind text, p_key text, p_ip text) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_key <> '-' and (select count(*) from auth_attempts a
           where a.kind = p_kind and a.key = p_key and not a.ok and a.at > now() - interval '15 minutes'
             and a.at > coalesce((select max(b.at) from auth_attempts b
                                   where b.kind = p_kind and b.key = p_key and b.ok), '-infinity')) >= 5)
      or (p_ip is not null and (select count(*) from auth_attempts a
           where a.kind = p_kind and a.ip = p_ip and not a.ok and a.at > now() - interval '15 minutes') >= 20)
$$;

create function public.auth_attempt_record(p_kind text, p_key text, p_ip text, p_ok boolean) returns void
language sql security definer set search_path = public as $$
  delete from auth_attempts where at < now() - interval '30 days';
  insert into auth_attempts (kind, key, ip, ok) values (p_kind, coalesce(p_key, '-'), p_ip, p_ok);
$$;

-- The hidden sign-in address behind a username (no real email is needed for a child).
create function public.account_login_email(p_username text) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id where p.username = p_username
$$;

-- Make a reset link for someone. At most 3 per account per hour, and 10 per adult per hour.
-- Any older unused link for that account stops working. Returns the email to send it to.
create function public.account_reset_create(p_actor uuid, p_user uuid, p_token_hash text)
returns table (recovery_email text, first_name text)
language plpgsql security definer set search_path = public as $$
declare em text; fname text;
begin
  if p_actor is not null and not public.account_can_manage(p_actor, p_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select c.recovery_email, p.first_name into em, fname
    from profiles p left join account_contacts c on c.user_id = p.id where p.id = p_user;
  if em is null then raise exception 'no_email'; end if;
  if (select count(*) from reset_tokens where user_id = p_user and created_at > now() - interval '1 hour') >= 3
     or (p_actor is not null and (select count(*) from reset_tokens
           where requested_by = p_actor and created_at > now() - interval '1 hour') >= 10) then
    raise exception 'rate_limited';
  end if;
  update reset_tokens set expires_at = now() where user_id = p_user and used_at is null and expires_at > now();
  insert into reset_tokens (user_id, token_hash, requested_by, expires_at)
  values (p_user, p_token_hash, p_actor, now() + interval '1 hour');
  insert into audit_log (actor_id, action, table_name, row_id, student_id, details)
  values (coalesce(p_actor, p_user), 'reset_requested', 'reset_tokens', p_user::text,
          case when (select role from profiles where id = p_user) = 'student' then p_user end,
          jsonb_build_object('by_self', p_actor is null));
  return query select em, fname;
end $$;

-- Use a reset link (once). Returns whose it is, or nothing if it is used, replaced or expired.
create function public.account_reset_use(p_token_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  update reset_tokens set used_at = now()
   where token_hash = p_token_hash and used_at is null and expires_at > now()
   returning user_id into uid;
  if uid is not null then
    insert into audit_log (actor_id, action, table_name, row_id, student_id)
    values (uid, 'reset_used', 'reset_tokens', uid::text,
            case when (select role from profiles where id = uid) = 'student' then uid end);
  end if;
  return uid;
end $$;

-- Sign someone out of every device: their saved sign-ins stop working at once, and the short-lived
-- login token they hold runs out within the hour.
create function public.account_end_sessions(p_actor uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if p_actor is not null and not public.account_can_manage(p_actor, p_user) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from auth.sessions where user_id = p_user;
  insert into public.audit_log (actor_id, action, table_name, row_id, student_id)
  values (coalesce(p_actor, p_user), 'sign_out_everywhere', 'auth.sessions', p_user::text,
          case when (select role from public.profiles where id = p_user) = 'student' then p_user end);
end $$;

revoke all on function
  public.account_can_manage(uuid, uuid),
  public.account_invite_create(uuid, text, text, uuid, text, integer),
  public.account_invite_peek(text),
  public.account_invite_finish(text, uuid, text, text),
  public.account_invite_list(uuid),
  public.account_invite_cancel(uuid, uuid),
  public.auth_attempt_blocked(text, text, text),
  public.auth_attempt_record(text, text, text, boolean),
  public.account_login_email(text),
  public.account_reset_create(uuid, uuid, text),
  public.account_reset_use(text),
  public.account_end_sessions(uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.account_can_manage(uuid, uuid),
  public.account_invite_create(uuid, text, text, uuid, text, integer),
  public.account_invite_peek(text),
  public.account_invite_finish(text, uuid, text, text),
  public.account_invite_list(uuid),
  public.account_invite_cancel(uuid, uuid),
  public.auth_attempt_blocked(text, text, text),
  public.auth_attempt_record(text, text, text, boolean),
  public.account_login_email(text),
  public.account_reset_create(uuid, uuid, text),
  public.account_reset_use(text),
  public.account_end_sessions(uuid, uuid)
  to service_role;
