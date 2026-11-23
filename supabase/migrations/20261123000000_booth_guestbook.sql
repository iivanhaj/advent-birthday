-- Door 6 · the photo booth's guestbook.
--
-- Only words are stored here; the photos never leave the visitor's browser.
-- Same security model as the rest of the site: the public key can READ notes,
-- and only our server route (service key, after its own checks) can write.

create table if not exists public.guest_notes (
  id         bigint generated always as identity primary key,
  message    text not null check (char_length(message) between 2 and 80),
  name       text not null default 'a guest' check (char_length(name) between 1 and 24),
  hidden     boolean not null default false,       -- flip to true to take a note down
  created_at timestamptz not null default now()
);
create index if not exists guest_notes_recent on public.guest_notes (created_at desc);

-- Who signed when, for the rate limit. `visitor` is a keyed hash of the IP
-- address (made on the server), never the address itself. No policies at all:
-- invisible to the public key.
create table if not exists public.guest_rate (
  visitor text not null,
  at      timestamptz not null default now()
);
create index if not exists guest_rate_visitor_at on public.guest_rate (visitor, at desc);

alter table public.guest_notes enable row level security;
alter table public.guest_rate  enable row level security;

drop policy if exists "anyone can read visible notes" on public.guest_notes;
create policy "anyone can read visible notes" on public.guest_notes
  for select to anon, authenticated using (not hidden);

revoke insert, update, delete, truncate on public.guest_notes from anon, authenticated;
revoke all on public.guest_rate from anon, authenticated;

-- Stream new notes to every open booth (Realtime respects the read policy,
-- so a hidden note is never sent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_notes'
  ) then
    alter publication supabase_realtime add table public.guest_notes;
  end if;
end $$;

-- Old rate-limit rows are useless after the window; clear anything over a day
-- old whenever a new one goes in, so the table stays tiny.
create or replace function public.prune_guest_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.guest_rate where at < now() - interval '1 day';
  return null;
end $$;

drop trigger if exists prune_guest_rate on public.guest_rate;
create trigger prune_guest_rate after insert on public.guest_rate
  for each statement execute function public.prune_guest_rate();
