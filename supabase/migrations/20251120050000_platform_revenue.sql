create table if not exists public.platform_revenue (
    id uuid primary key default gen_random_uuid(),
    payment_id uuid not null references public.payments(id) on delete cascade,
    amount numeric not null,
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists platform_revenue_payment_idx on public.platform_revenue(payment_id);

alter table public.platform_revenue enable row level security;

create policy if not exists "Service role views platform revenue" on public.platform_revenue
for select using (auth.role() = 'service_role');

create policy if not exists "Service role inserts platform revenue" on public.platform_revenue
for insert with check (auth.role() = 'service_role');

create policy if not exists "Service role updates platform revenue" on public.platform_revenue
for update using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
