create extension if not exists "pgcrypto";

create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    username text,
    avatar_url text,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.creators (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    bio text,
    price_per_minute numeric,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lives (
    id uuid primary key default gen_random_uuid(),
    creator_id uuid not null references public.creators(id) on delete cascade,
    title text not null,
    description text,
    price numeric,
    room_name text,
    is_active boolean not null default false,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    live_id uuid not null references public.lives(id) on delete cascade,
    amount numeric not null,
    status text not null,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.live_access (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    live_id uuid not null references public.lives(id) on delete cascade,
    granted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commissions (
    id uuid primary key default gen_random_uuid(),
    creator_id uuid not null references public.creators(id) on delete cascade,
    payment_id uuid not null references public.payments(id) on delete cascade,
    commission_amount numeric not null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists creators_user_id_idx on public.creators(user_id);
create index if not exists lives_creator_id_idx on public.lives(creator_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_live_id_idx on public.payments(live_id);
create index if not exists live_access_user_id_idx on public.live_access(user_id);
create index if not exists live_access_live_id_idx on public.live_access(live_id);
create index if not exists commissions_creator_id_idx on public.commissions(creator_id);
create index if not exists commissions_payment_id_idx on public.commissions(payment_id);

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.lives enable row level security;
alter table public.payments enable row level security;
alter table public.live_access enable row level security;
alter table public.commissions enable row level security;

create policy "Users can view own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Creators can update own creator info" on public.creators
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Public can view creators" on public.creators
for select using (true);

create policy "Creators can update own lives" on public.lives
for update using (
    exists (
        select 1 from public.creators c
        where c.id = public.lives.creator_id
          and c.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.creators c
        where c.id = public.lives.creator_id
          and c.user_id = auth.uid()
    )
);

create policy "Public can view active lives" on public.lives
for select using (is_active);

create policy "Users view own payments" on public.payments
for select using (auth.uid() = user_id);

create policy "Service role inserts payments" on public.payments
for insert with check (auth.role() = 'service_role');

create policy "Users view own live access" on public.live_access
for select using (auth.uid() = user_id);

create policy "Service role inserts live access" on public.live_access
for insert with check (auth.role() = 'service_role');

create policy "Creators view own commissions" on public.commissions
for select using (
    exists (
        select 1 from public.creators c
        where c.id = public.commissions.creator_id
          and c.user_id = auth.uid()
    )
);

create policy "Service role inserts commissions" on public.commissions
for insert with check (auth.role() = 'service_role');
