begin;

-- Ensure a per-profile credits wallet using integer credits
create table if not exists public.credits_wallet (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance_credits integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.credits_wallet
  add column if not exists profile_id uuid,
  add column if not exists balance_credits integer,
  add column if not exists updated_at timestamptz;

update public.credits_wallet
set balance_credits = coalesce(balance_credits, 0),
    updated_at = coalesce(updated_at, now())
where balance_credits is null
   or updated_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'credits_wallet'
      and column_name = 'balance_credits'
      and data_type <> 'integer'
  ) then
    alter table public.credits_wallet
      alter column balance_credits type integer using round(balance_credits)::integer;
  end if;
end;
$$;

alter table public.credits_wallet
  alter column balance_credits set default 0,
  alter column balance_credits set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column profile_id set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'credits_wallet'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.credits_wallet
      add constraint credits_wallet_pkey primary key (profile_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
    where tc.table_schema = 'public'
      and tc.table_name = 'credits_wallet'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'profile_id'
  ) then
    alter table public.credits_wallet
      add constraint credits_wallet_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
end;
$$;

alter table public.credits_wallet enable row level security;

create policy "Users view own credits_wallet" on public.credits_wallet
  for select using (auth.uid() = profile_id);

create policy "Service role manages credits_wallet" on public.credits_wallet
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Capture Mercado Pago credit purchases with idempotent payment_id
create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  credits integer not null,
  amount_cents integer not null,
  status text not null,
  payment_id text not null,
  created_at timestamptz not null default now()
);

alter table public.credit_purchases
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists profile_id uuid,
  add column if not exists credits integer,
  add column if not exists amount_cents integer,
  add column if not exists status text,
  add column if not exists payment_id text,
  add column if not exists created_at timestamptz;

update public.credit_purchases
set credits = coalesce(credits, 0),
    amount_cents = coalesce(amount_cents, 0),
    status = coalesce(status, 'pending'),
    payment_id = coalesce(payment_id, concat('missing-payment-id-', gen_random_uuid())),
    created_at = coalesce(created_at, now())
where credits is null
   or amount_cents is null
   or status is null
   or payment_id is null
   or created_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'credit_purchases'
      and column_name = 'credits'
      and data_type <> 'integer'
  ) then
    alter table public.credit_purchases
      alter column credits type integer using round(credits)::integer;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'credit_purchases'
      and column_name = 'amount_cents'
      and data_type <> 'integer'
  ) then
    alter table public.credit_purchases
      alter column amount_cents type integer using round(amount_cents)::integer;
  end if;
end;
$$;

alter table public.credit_purchases
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column profile_id set not null,
  alter column credits set not null,
  alter column amount_cents set not null,
  alter column status set not null,
  alter column payment_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'credit_purchases'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.credit_purchases
      add constraint credit_purchases_pkey primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
    where tc.table_schema = 'public'
      and tc.table_name = 'credit_purchases'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'profile_id'
  ) then
    alter table public.credit_purchases
      add constraint credit_purchases_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists credit_purchases_payment_id_idx on public.credit_purchases(payment_id);
create index if not exists credit_purchases_profile_id_idx on public.credit_purchases(profile_id);

alter table public.credit_purchases enable row level security;

create policy "Users view own credit_purchases" on public.credit_purchases
  for select using (auth.uid() = profile_id);

create policy "Service role manages credit_purchases" on public.credit_purchases
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Creator wallet in cents for payouts
create table if not exists public.creator_wallet (
  creator_id uuid primary key references public.profiles(id) on delete cascade,
  balance_cents integer not null default 0,
  pending_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.creator_wallet
  add column if not exists creator_id uuid,
  add column if not exists balance_cents integer,
  add column if not exists pending_cents integer,
  add column if not exists updated_at timestamptz;

update public.creator_wallet
set balance_cents = coalesce(balance_cents, 0),
    pending_cents = coalesce(pending_cents, 0),
    updated_at = coalesce(updated_at, now())
where balance_cents is null
   or pending_cents is null
   or updated_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'creator_wallet'
      and column_name = 'balance_cents'
      and data_type <> 'integer'
  ) then
    alter table public.creator_wallet
      alter column balance_cents type integer using round(balance_cents)::integer;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'creator_wallet'
      and column_name = 'pending_cents'
      and data_type <> 'integer'
  ) then
    alter table public.creator_wallet
      alter column pending_cents type integer using round(pending_cents)::integer;
  end if;
end;
$$;

alter table public.creator_wallet
  alter column balance_cents set default 0,
  alter column balance_cents set not null,
  alter column pending_cents set default 0,
  alter column pending_cents set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column creator_id set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'creator_wallet'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.creator_wallet
      add constraint creator_wallet_pkey primary key (creator_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
    where tc.table_schema = 'public'
      and tc.table_name = 'creator_wallet'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'creator_id'
  ) then
    alter table public.creator_wallet
      add constraint creator_wallet_creator_id_fkey
      foreign key (creator_id) references public.profiles(id) on delete cascade;
  end if;
end;
$$;

alter table public.creator_wallet enable row level security;

create policy "Creators view own creator_wallet" on public.creator_wallet
  for select using (auth.uid() = creator_id);

create policy "Service role manages creator_wallet" on public.creator_wallet
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

commit;
