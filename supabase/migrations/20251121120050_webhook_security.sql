create table if not exists public.webhook_events (
  idempotency_key text primary key,
  processed_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;

create policy "service role manages webhook events"
  on public.webhook_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
