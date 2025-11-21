-- Credits system migration
-- Add credit balance to profiles
alter table public.profiles
  add column if not exists credit_balance integer not null default 0;

-- Track credits consumed per live access
alter table public.live_access
  add column if not exists credits_consumed integer not null default 0;

-- Credit purchases audit table
create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credits_added integer not null,
  payment_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists credit_purchases_user_id_idx on public.credit_purchases(user_id);

alter table public.credit_purchases enable row level security;

create policy if not exists "Users view own credit purchases" on public.credit_purchases
  for select using (auth.uid() = user_id);

create policy if not exists "Service role manages credit purchases" on public.credit_purchases
  for all using (request.jwt().role = 'service_role') with check (request.jwt().role = 'service_role');

-- Utility functions for atomic credit management
create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    return (select credit_balance from public.profiles where id = p_user_id);
  end if;

  update public.profiles
    set credit_balance = credit_balance + p_amount
    where id = p_user_id
    returning credit_balance into new_balance;

  return coalesce(new_balance, 0);
end;
$$;

create or replace function public.consume_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
as $$
declare
  current_balance integer;
  deduction integer;
  new_balance integer;
begin
  select credit_balance into current_balance from public.profiles where id = p_user_id for update;

  if current_balance is null then
    return 0;
  end if;

  if p_amount <= 0 then
    return current_balance;
  end if;

  deduction := least(p_amount, current_balance);

  update public.profiles
    set credit_balance = credit_balance - deduction
    where id = p_user_id
    returning credit_balance into new_balance;

  return coalesce(new_balance, 0);
end;
$$;

create or replace function public.get_credit_balance(p_user_id uuid)
returns integer
language sql
as $$
  select credit_balance from public.profiles where id = p_user_id;
$$;
