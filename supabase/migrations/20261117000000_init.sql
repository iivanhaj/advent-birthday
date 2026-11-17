-- Birthday advent calendar: first schema.
--
-- Security model in one sentence: the public (anon) key can READ the tables
-- the site shows, and NOTHING can write except our own server code using the
-- service-role key (which bypasses RLS), after it has verified the caller.

-- ─── tables ──────────────────────────────────────────────────────────────────

create table public.doors (
  n           smallint primary key check (n between 1 and 11),
  date        date not null unique,          -- the IST day this door opens
  title       text not null,
  sprouted_at timestamptz,                   -- first push landed on its day
  shipped_at  timestamptz                    -- a commit said door:N
);

create table public.pushes (
  id          bigint generated always as identity primary key,
  delivery_id text not null unique,          -- X-GitHub-Delivery: the idempotency key
  repo        text,
  sha         text,
  message     text,
  pushed_at   timestamptz not null default now(),
  ist_date    date not null
);

create table public.pet (
  id          smallint primary key default 1 check (id = 1),  -- exactly one pet
  hunger      smallint not null default 0 check (hunger between 0 and 100),
  mood        text not null default 'happy',
  last_fed_at timestamptz
);

create table public.push_subscriptions (
  id         bigint generated always as identity primary key,
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

create table public.letters (
  id          uuid primary key default gen_random_uuid(),
  ciphertext  text not null,                 -- only ever ciphertext (time-lock encrypted)
  drand_round bigint not null,               -- the beacon round that can decrypt it
  created_at  timestamptz not null default now()
);

-- ─── row level security ─────────────────────────────────────────────────────
-- With RLS on and no policy, a table is invisible to anon/authenticated.
-- We add read-only policies for what the site displays.

alter table public.doors              enable row level security;
alter table public.pushes             enable row level security;
alter table public.pet                enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.letters            enable row level security;

create policy "anyone can read doors"   on public.doors   for select to anon, authenticated using (true);
create policy "anyone can read pushes"  on public.pushes  for select to anon, authenticated using (true);
create policy "anyone can read the pet" on public.pet     for select to anon, authenticated using (true);
-- Letters are public on purpose: they're time-lock ciphertext, unreadable until the drand round.
create policy "anyone can read letters" on public.letters for select to anon, authenticated using (true);
-- push_subscriptions: no policy at all. Endpoints are private-ish; only the server reads them.

-- Belt and braces: even if someone adds a permissive policy by mistake later,
-- the public roles simply don't hold write privileges.
revoke insert, update, delete, truncate on public.doors, public.pushes, public.pet, public.letters from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;

-- ─── seed ───────────────────────────────────────────────────────────────────

insert into public.doors (n, date, title) values
  (1,  '2026-11-18', 'The living garden'),
  (2,  '2026-11-19', 'Coding pet'),
  (3,  '2026-11-20', 'Birthday-seeded art'),
  (4,  '2026-11-21', 'GPU koi pond'),
  (5,  '2026-11-22', 'Recursive flowers'),
  (6,  '2026-11-23', 'Cozy room, real sky'),
  (7,  '2026-11-24', 'Firefly music'),
  (8,  '2026-11-25', 'Holographic card'),
  (9,  '2026-11-26', 'Time-locked letter'),
  (10, '2026-11-27', 'Jae: The Game'),
  (11, '2026-11-28', 'Blow out the candles');

insert into public.pet (id) values (1);

-- ─── realtime ───────────────────────────────────────────────────────────────
-- Stream row changes on `doors` to subscribed browsers (RLS still applies:
-- clients only receive rows their select policy allows).

alter publication supabase_realtime add table public.doors;

-- ─── record_push: the webhook's whole job, in one transaction ───────────────
--
-- Why a database function instead of three calls from the route handler?
-- Atomicity. If we inserted the push and then crashed before sprouting the
-- door, GitHub's retry would be treated as a duplicate and the sprout would
-- be lost forever. Here, dedupe + sprout + ship either all happen or none do.
--
-- Idempotency: `on conflict (delivery_id) do nothing` makes a redelivered
-- webhook a no-op. `found` is false when the insert was skipped.

create function public.record_push(
  p_delivery_id text,
  p_repo        text,
  p_sha         text,
  p_message     text,
  p_pushed_at   timestamptz,
  p_ist_date    date,
  p_ship_doors  smallint[]
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sprouted smallint[];
  v_shipped  smallint[];
begin
  insert into pushes (delivery_id, repo, sha, message, pushed_at, ist_date)
  values (p_delivery_id, p_repo, p_sha, p_message, p_pushed_at, p_ist_date)
  on conflict (delivery_id) do nothing;

  if not found then
    return jsonb_build_object('duplicate', true);
  end if;

  -- Sprout today's door (only the first push of the day sets the timestamp).
  with s as (
    update doors set sprouted_at = p_pushed_at
    where date = p_ist_date and sprouted_at is null
    returning n
  )
  select coalesce(array_agg(n), '{}') into v_sprouted from s;

  -- Ship any door tagged door:N, but never a future door (date guard),
  -- and never twice. Shipping also counts as sprouting.
  with sh as (
    update doors
    set shipped_at  = p_pushed_at,
        sprouted_at = coalesce(sprouted_at, p_pushed_at)
    where n = any(p_ship_doors) and date <= p_ist_date and shipped_at is null
    returning n
  )
  select coalesce(array_agg(n), '{}') into v_shipped from sh;

  return jsonb_build_object('duplicate', false, 'sprouted', v_sprouted, 'shipped', v_shipped);
end;
$$;

-- Only the server (service role) may call it.
revoke all on function public.record_push(text, text, text, text, timestamptz, date, smallint[]) from public, anon, authenticated;
grant execute on function public.record_push(text, text, text, text, timestamptz, date, smallint[]) to service_role;
