-- Enhance affiliate logs with platform share and event typing and add helper for affiliate earnings
alter table public.affiliate_logs
  add column if not exists amount_platform integer not null default 0,
  add column if not exists event_type text not null default 'REGISTRATION',
  add column if not exists payment_id text;

create index if not exists affiliate_logs_payment_idx on public.affiliate_logs(payment_id);

create or replace function public.increment_affiliate_earnings(
  p_profile_id uuid,
  p_amount_cents integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  update public.profiles
    set affiliate_earnings = coalesce(affiliate_earnings, 0) + coalesce(p_amount_cents, 0)
    where id = p_profile_id
    returning affiliate_earnings into new_total;

  return new_total;
end;
$$;
