create table if not exists public.referral_links (
    id uuid primary key default gen_random_uuid(),
    creator_id uuid not null references public.creators(id) on delete cascade,
    code text not null unique,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.referral_conversions (
    id uuid primary key default gen_random_uuid(),
    referral_code text not null,
    parent_creator_id uuid not null references public.creators(id) on delete cascade,
    new_creator_id uuid not null references public.creators(id) on delete cascade,
    commission_amount numeric not null default 0.50,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.creator_balance (
    id uuid primary key default gen_random_uuid(),
    creator_id uuid not null references public.creators(id) on delete cascade,
    balance numeric not null default 0,
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.withdrawals (
    id uuid primary key default gen_random_uuid(),
    creator_id uuid not null references public.creators(id) on delete cascade,
    amount numeric not null,
    status text not null default 'pending',
    created_at timestamptz not null default timezone('utc', now()),
    processed_at timestamptz
);

create index if not exists referral_conversions_parent_idx on public.referral_conversions(parent_creator_id);
create index if not exists referral_conversions_new_idx on public.referral_conversions(new_creator_id);
create index if not exists creator_balance_creator_id_idx on public.creator_balance(creator_id);
create index if not exists withdrawals_creator_id_idx on public.withdrawals(creator_id);

alter table public.referral_links enable row level security;
alter table public.referral_conversions enable row level security;
alter table public.creator_balance enable row level security;
alter table public.withdrawals enable row level security;

create policy "Creators view own referral links" on public.referral_links
for select using (
    exists (
        select 1 from public.creators c
        where c.id = public.referral_links.creator_id
          and c.user_id = auth.uid()
    )
);

create policy "Service role manages referral links" on public.referral_links
for select using (auth.role() = 'service_role');

create policy "Service role inserts referral links" on public.referral_links
for insert with check (auth.role() = 'service_role');

create policy "Service role updates referral links" on public.referral_links
for update using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Creators view own referral conversions" on public.referral_conversions
for select using (
    exists (
        select 1 from public.creators c
        where c.id = public.referral_conversions.parent_creator_id
          and c.user_id = auth.uid()
    )
);

create policy "Service role selects referral conversions" on public.referral_conversions
for select using (auth.role() = 'service_role');

create policy "Service role inserts referral conversions" on public.referral_conversions
for insert with check (auth.role() = 'service_role');

create policy "Service role updates referral conversions" on public.referral_conversions
for update using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Creators view own balances" on public.creator_balance
for select using (
    exists (
        select 1 from public.creators c
        where c.id = public.creator_balance.creator_id
          and c.user_id = auth.uid()
    )
);

create policy "Service role manages balances" on public.creator_balance
for select using (auth.role() = 'service_role');

create policy "Service role inserts balances" on public.creator_balance
for insert with check (auth.role() = 'service_role');

create policy "Service role updates balances" on public.creator_balance
for update using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Creators view own withdrawals" on public.withdrawals
for select using (
    exists (
        select 1 from public.creators c
        where c.id = public.withdrawals.creator_id
          and c.user_id = auth.uid()
    )
);

create policy "Service role inserts withdrawals" on public.withdrawals
for insert with check (auth.role() = 'service_role');

create policy "Service role updates withdrawals" on public.withdrawals
for update using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
