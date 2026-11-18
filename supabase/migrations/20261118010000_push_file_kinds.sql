-- Door 1 · the greenhouse
-- Each push remembers which kinds of files it touched, e.g. {"ts": 3, "css": 1},
-- so its flower can be tinted with that tech stack's colour.

alter table public.pushes add column if not exists files jsonb not null default '{}'::jsonb;

-- record_push gains one argument (p_files). Postgres identifies a function by
-- its argument list, so the old version is dropped and recreated.
drop function if exists public.record_push(text, text, text, text, timestamptz, date, smallint[]);

create function public.record_push(
  p_delivery_id text,
  p_repo        text,
  p_sha         text,
  p_message     text,
  p_pushed_at   timestamptz,
  p_ist_date    date,
  p_ship_doors  smallint[],
  p_files       jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sprouted smallint[];
  v_shipped  smallint[];
begin
  insert into pushes (delivery_id, repo, sha, message, pushed_at, ist_date, files)
  values (p_delivery_id, p_repo, p_sha, p_message, p_pushed_at, p_ist_date, coalesce(p_files, '{}'::jsonb))
  on conflict (delivery_id) do nothing;

  if not found then
    return jsonb_build_object('duplicate', true);
  end if;

  with s as (
    update doors set sprouted_at = p_pushed_at
    where date = p_ist_date and sprouted_at is null
    returning n
  )
  select coalesce(array_agg(n), '{}') into v_sprouted from s;

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

revoke all on function public.record_push(text, text, text, text, timestamptz, date, smallint[], jsonb) from public, anon, authenticated;
grant execute on function public.record_push(text, text, text, text, timestamptz, date, smallint[], jsonb) to service_role;
