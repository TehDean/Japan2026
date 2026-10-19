-- Japan December Plan: automatic suggestions (already applied to the japan2026 project through the Supabase connector).
-- Kept here as a record. Safe to run more than once.

create table if not exists public.trip_plan (
  id          int primary key default 1 check (id = 1),
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  note        text
);
alter table public.trip_plan enable row level security;
revoke all on public.trip_plan from anon, authenticated;

create table if not exists public.trip_plan_versions (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  data           jsonb not null,
  note           text,
  suggestion_id  bigint
);
alter table public.trip_plan_versions enable row level security;
revoke all on public.trip_plan_versions from anon, authenticated;

create or replace function public.get_trip_plan()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('data', p.data, 'updated_at', p.updated_at) from public.trip_plan p where p.id = 1;
$$;
revoke all on function public.get_trip_plan() from public;
grant execute on function public.get_trip_plan() to anon, authenticated;

alter table public.trip_suggestions add column if not exists processing_at timestamptz;

-- No daily limit: spending is capped by the Anthropic workspace's monthly spend limit instead.
create or replace function public.send_trip_suggestion(p_device uuid, p_by text, p_day text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  insert into public.trip_suggestions (device_id, suggested_by, day, body)
  values (p_device, left(trim(p_by), 30), nullif(left(trim(p_day), 20), ''), left(trim(p_body), 500))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.send_trip_suggestion(uuid, text, text, text) from public;
grant execute on function public.send_trip_suggestion(uuid, text, text, text) to anon, authenticated;

create or replace function public.list_trip_suggestions_v2()
returns table (id bigint, created_at timestamptz, suggested_by text, day text, body text, status text, reply text)
language sql stable security definer set search_path = public as $$
  select s.id, s.created_at, s.suggested_by, s.day, s.body,
         case when s.status = 'new' and s.processing_at is not null and s.processing_at > now() - interval '5 minutes' then 'working' else s.status end,
         s.reply
  from public.trip_suggestions s order by s.created_at desc limit 50;
$$;
revoke all on function public.list_trip_suggestions_v2() from public;
grant execute on function public.list_trip_suggestions_v2() to anon, authenticated;

-- The old send function (20 a day) is no longer callable from the website.
revoke execute on function public.suggest_trip_change(uuid, text, text, text) from anon, authenticated;
