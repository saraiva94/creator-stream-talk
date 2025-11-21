-- Two-level affiliate system for registration earnings
alter table public.profiles
  add column if not exists referrer_root uuid references public.profiles(id) on delete set null,
  add column if not exists referrer_direct uuid references public.profiles(id) on delete set null,
  add column if not exists affiliate_earnings integer not null default 0;

create table if not exists public.affiliate_logs (
  id uuid primary key default gen_random_uuid(),
  new_user uuid not null references public.profiles(id) on delete cascade,
  root_creator uuid references public.profiles(id) on delete set null,
  direct_referrer uuid references public.profiles(id) on delete set null,
  amount_root integer not null default 0,
  amount_direct integer not null default 0,
  created_at timestamptz default timezone('utc', now())
);

create index if not exists affiliate_logs_new_user_idx on public.affiliate_logs(new_user);
create index if not exists affiliate_logs_root_idx on public.affiliate_logs(root_creator);
create index if not exists affiliate_logs_direct_idx on public.affiliate_logs(direct_referrer);

alter table public.affiliate_logs enable row level security;

create policy if not exists "Service role manages affiliate logs" on public.affiliate_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.process_registration_affiliate_payout(
  p_new_user uuid,
  p_root_creator uuid,
  p_direct_referrer uuid,
  p_amount_root integer,
  p_amount_direct integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_root_creator is not null and p_amount_root > 0 then
    update public.profiles
      set affiliate_earnings = affiliate_earnings + p_amount_root
    where id = p_root_creator;
  end if;

  if p_direct_referrer is not null and p_amount_direct > 0 then
    update public.profiles
      set affiliate_earnings = affiliate_earnings + p_amount_direct
    where id = p_direct_referrer;
  end if;

  insert into public.affiliate_logs (new_user, root_creator, direct_referrer, amount_root, amount_direct)
  values (p_new_user, p_root_creator, p_direct_referrer, p_amount_root, p_amount_direct);
end;
$$;
