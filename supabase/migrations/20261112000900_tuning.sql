-- Step 2, part 9: small fixes found by Supabase's own advisor after the first apply.
-- Nothing here changes who may do what; the security tests give the same answers before and after.

-- 1. Pin the search path of the last function that did not have one.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- 2. Policies that call auth.uid() directly make Postgres ask again for every row. Wrapping it as
--    (select auth.uid()) makes it ask once per query. Rewritten in place, keeping every rule as it was.
do $$
declare p record; q text; w text; ddl text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
            where schemaname in ('public', 'storage')
              and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
              and coalesce(qual, '') not ilike '%select auth.uid()%' and coalesce(with_check, '') not ilike '%select auth.uid()%' loop
    ddl := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then ddl := ddl || ' using (' || replace(p.qual, 'auth.uid()', '(select auth.uid())') || ')'; end if;
    if p.with_check is not null then ddl := ddl || ' with check (' || replace(p.with_check, 'auth.uid()', '(select auth.uid())') || ')'; end if;
    execute ddl;
  end loop;
end $$;
