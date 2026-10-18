-- Tokyo December Plan: let the review key clear the suggestion list.
-- Paste this into Supabase > SQL Editor > New query (japan2026 project), then click Run.
-- It only adds one command; nothing is deleted until that command is used with the review key.
-- It is safe to run more than once.

create or replace function public.clear_trip_suggestions(p_key text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_key = 'PUT-YOUR-REVIEW-KEY-HERE' or not exists (select 1 from public.review_keys k where k.key = p_key) then
    raise exception 'Not allowed';
  end if;
  select count(*) into n from public.trip_suggestions;
  truncate public.trip_suggestions restart identity;
  return n;
end $$;

revoke all on function public.clear_trip_suggestions(text) from public;
grant execute on function public.clear_trip_suggestions(text) to anon, authenticated;
