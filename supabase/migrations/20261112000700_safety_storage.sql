-- Step 2, part 7: automation keys, the chat counter, and the private photo bucket.

-- AUTOMATION KEYS --------------------------------------------------------------------------------
-- One per pull task, tied to one student. Only a hash is stored. A coach can revoke it.
-- A key is not a database login. It is presented to a server function, which calls the functions
-- below with the server key. Those functions can only ever touch the one student the key belongs to.
create table public.automation_keys (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  key_hash      bytea not null unique,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  last_used_at  timestamptz
);
alter table public.automation_keys enable row level security;
-- A coach may list the keys of her students. The hash column is not granted to anyone (see the grants file).
create policy automation_keys_read on public.automation_keys for select to authenticated
  using (public.is_coach_of(student_id));
create trigger t4_audit after insert or update or delete on public.automation_keys for each row execute function public.audit_change();

-- Make a key. Returns the raw key once; it is never stored and cannot be shown again.
create function public.create_automation_key(p_student uuid, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare raw text;
begin
  if auth.uid() is null or not public.is_coach_of(p_student) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  raw := 'ek_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.automation_keys (student_id, name, key_hash, created_by)
  values (p_student, p_name, sha256(convert_to(raw, 'UTF8')), auth.uid());
  return raw;
end $$;

create function public.revoke_automation_key(p_key uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  select student_id into s from public.automation_keys where id = p_key;
  if auth.uid() is null or s is null or not public.is_coach_of(s) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.automation_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key;
end $$;

-- Which student does this key belong to? Null for an unknown or revoked key. Server key only.
create function public.automation_student_for_key(raw_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s uuid; k uuid;
begin
  if raw_key is null then return null; end if;
  select id, student_id into k, s from public.automation_keys
   where key_hash = sha256(convert_to(raw_key, 'UTF8')) and revoked_at is null;
  if k is null then return null; end if;
  update public.automation_keys set last_used_at = now() where id = k;
  return s;
end $$;

-- What an automation key may do: add or update tasks, and mark them verified, for its one student.
-- It cannot read anything, cannot touch a finished task, and cannot set done-state or coins.
create function public.automation_upsert_task(
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
                            value_set_by, coins, type)
  values (s, p_date, p_title, p_note, p_minutes, p_due_date, 'platform', p_platform, p_external_id,
          'platform', 3, 'school')                      -- 3 is the default task value (PRD 3a)
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

-- CHAT COUNTER ------------------------------------------------------------------------------------
create table public.chat_usage (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,
  count    integer not null default 0,
  primary key (user_id, day)
);
alter table public.chat_usage enable row level security;
create policy chat_usage_read on public.chat_usage for select to authenticated using (user_id = auth.uid());

-- PHOTOS ------------------------------------------------------------------------------------------
-- One private bucket. The first folder in a photo's path is the student's ID. Nobody can list it.
-- Photos open only through short links the server makes after authorize_photo_open says yes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof-photos', 'proof-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- A student may add a photo into her own folder only. No reading, listing, replacing or deleting by anyone in the app.
create policy proof_photos_student_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proof-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.app_role() = 'student');

-- The check before the server makes a short-lived link. Her coach or her parent may open her photos;
-- the student, other students and other parents may not. Each open is written to the audit log.
create function public.authorize_photo_open(p_path text) returns boolean
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  begin
    sid := (string_to_array(p_path, '/'))[1]::uuid;
  exception when others then
    raise exception 'not allowed' using errcode = '42501';
  end;
  if auth.uid() is null or not (public.is_coach_of(sid) or public.is_parent_of(sid)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, student_id, details)
  values (auth.uid(), 'open_photo', 'storage.objects', p_path, sid, '{}'::jsonb);
  return true;
end $$;
