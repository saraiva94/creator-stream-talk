-- Registration paywall and two-level affiliate metadata
alter table public.profiles
  add column if not exists is_root_creator boolean not null default false,
  add column if not exists referrer_id uuid references public.profiles(id) on delete set null,
  add column if not exists referrer_parent_id uuid references public.profiles(id) on delete set null;

create table if not exists public.registration_referrals (
  payment_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  referrer_id uuid references public.profiles(id) on delete set null,
  referrer_parent_id uuid references public.profiles(id) on delete set null,
  is_root_creator boolean not null default false,
  is_free boolean not null default false,
  created_at timestamptz default timezone('utc', now())
);

create index if not exists registration_referrals_user_idx on public.registration_referrals(user_id);

alter table public.registration_referrals enable row level security;

drop policy if exists "Service role manages registration referrals" on public.registration_referrals;

create policy "Service role manages registration referrals"
  on public.registration_referrals
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
