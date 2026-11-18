-- Door 1 · window boxes and constellations
-- Stream new rows in `pushes` to browsers (Supabase Realtime), so a push grows
-- its flower and lights its star on screen within a second. The table already
-- has a public read policy, and Realtime respects it.

alter publication supabase_realtime add table public.pushes;
