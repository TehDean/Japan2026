-- Tokyo December Plan: "Suggest a change"
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Uses the same Supabase project and review key as Adult Fun Finder.
-- It is safe to run more than once.

-- 1. Suggestions sent from the website
create table if not exists public.trip_suggestions (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  device_id    uuid not null,
  suggested_by text not null check (char_length(suggested_by) between 1 and 30),
  day          text check (day is null or char_length(day) <= 20),
  body         text not null check (char_length(body) between 3 and 500),
  status       text not null default 'new' check (status in ('new', 'done', 'skipped')),
  reply        text check (reply is null or char_length(reply) <= 300),
  reviewed_at  timestamptz
);
alter table public.trip_suggestions enable row level security;
revoke all on public.trip_suggestions from anon, authenticated;

-- 2. The private review key (shared with Adult Fun Finder; nobody can read it from a website)
create table if not exists public.review_keys (key text primary key);
alter table public.review_keys enable row level security;
revoke all on public.review_keys from anon, authenticated;

-- 3. Send a suggestion (at most 20 per phone per day)
create or replace function public.suggest_trip_change(p_device uuid, p_by text, p_day text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trip_suggestions where device_id = p_device and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many suggestions today' using errcode = 'P0001';
  end if;
  insert into public.trip_suggestions (device_id, suggested_by, day, body)
  values (p_device, left(trim(p_by), 30), nullif(left(trim(p_day), 20), ''), left(trim(p_body), 500));
end $$;

-- 4. The list shown on the website (no device ids)
create or replace function public.list_trip_suggestions()
returns table (id bigint, created_at timestamptz, suggested_by text, day text, body text, status text, reply text)
language sql stable security definer set search_path = public as $$
  select s.id, s.created_at, s.suggested_by, s.day, s.body, s.status, s.reply
  from public.trip_suggestions s order by s.created_at desc limit 50;
$$;

-- 5. Mark a suggestion done or skipped, with a short reply (needs the review key)
create or replace function public.mark_trip_suggestion(p_key text, p_id bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'PUT-YOUR-REVIEW-KEY-HERE' or not exists (select 1 from public.review_keys k where k.key = p_key) then
    raise exception 'Not allowed';
  end if;
  if p_status not in ('new', 'done', 'skipped') then raise exception 'Unknown status'; end if;
  update public.trip_suggestions
     set status = p_status, reply = nullif(left(trim(p_reply), 300), ''), reviewed_at = now()
   where id = p_id;
end $$;

revoke all on function public.suggest_trip_change(uuid, text, text, text) from public;
revoke all on function public.list_trip_suggestions() from public;
revoke all on function public.mark_trip_suggestion(text, bigint, text, text) from public;
grant execute on function public.suggest_trip_change(uuid, text, text, text) to anon, authenticated;
grant execute on function public.list_trip_suggestions() to anon, authenticated;
grant execute on function public.mark_trip_suggestion(text, bigint, text, text) to anon, authenticated;
