begin;

create table if not exists public.withdrawal_audit_log (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.withdrawals(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists withdrawal_audit_log_withdrawal_idx on public.withdrawal_audit_log(withdrawal_id);

alter table public.withdrawal_audit_log enable row level security;

create policy "Service role manages withdrawal audit log" on public.withdrawal_audit_log
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Admins audit withdrawals" on public.withdrawal_audit_log
for all using (
  coalesce((auth.jwt() ->> 'app_role'), (auth.jwt() ->> 'role'), '') = 'admin'
)
with check (
  coalesce((auth.jwt() ->> 'app_role'), (auth.jwt() ->> 'role'), '') = 'admin'
);

create policy "Admins manage withdrawals" on public.withdrawals
for all using (
  coalesce((auth.jwt() ->> 'app_role'), (auth.jwt() ->> 'role'), '') = 'admin'
)
with check (
  coalesce((auth.jwt() ->> 'app_role'), (auth.jwt() ->> 'role'), '') = 'admin'
);

commit;
