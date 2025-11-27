begin;

create table public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  live_id uuid not null references public.lives(id) on delete cascade,
  credits_consumed integer not null,
  gross_cents integer not null,
  net_cents integer not null,
  platform_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'settled', 'cancelled')),
  settled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint creator_earnings_live_unique unique (live_id)
);

create index creator_earnings_creator_id_idx on public.creator_earnings(creator_id);
create index creator_earnings_live_id_idx on public.creator_earnings(live_id);
create index creator_earnings_status_idx on public.creator_earnings(status);

alter table public.creator_earnings enable row level security;

create policy "Service role manages creator_earnings" on public.creator_earnings
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Creators view own creator_earnings" on public.creator_earnings
  for select using (auth.uid() = creator_id);

commit;
