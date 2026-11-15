-- Step 7, part 2: a task added by server code keeps exactly the value it was given.
-- Found while checking step 10's import: the default level (normal, or "waiting" for her own tasks) was also
-- filled in for server inserts that passed 0 coins and no level, which would give an imported old finished
-- task 1.5 coins it never earned. Now the default is filled in only for tasks added through the app
-- (a coach or the student). Server code (intake, platforms, templates, the import) passes a level, or its
-- coins are kept as given. Nothing else changes.
create or replace function public.tasks_value() returns trigger
language plpgsql set search_path = public as $$
declare signed_in boolean := current_user = 'authenticated';
begin
  if tg_op = 'INSERT' then
    if new.value_level is null and signed_in then
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
revoke all on function public.tasks_value() from public, anon, authenticated;
