-- Door 1 · window boxes and constellations
-- Stream new rows in `pushes` to browsers (Supabase Realtime), so a push grows
-- its flower and lights its star on screen within a second. The table already
-- has a public read policy, and Realtime respects it.
--
-- Safe to run more than once: it only adds the table if it isn't already in
-- the publication (re-adding it raises error 42710).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pushes'
  ) then
    alter publication supabase_realtime add table public.pushes;
  end if;
end $$;
