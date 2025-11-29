begin;

create table if not exists public.live_consumption (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_token text not null,
  seconds_watched integer not null default 0,
  credits_consumed integer not null default 0,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  constraint live_consumption_live_user_session_key unique (live_id, user_id, session_token)
);

create index if not exists live_consumption_live_id_idx on public.live_consumption(live_id);
create index if not exists live_consumption_user_id_idx on public.live_consumption(user_id);

alter table public.live_consumption enable row level security;

create policy "Service role manages live_consumption" on public.live_consumption
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Users can view own live_consumption" on public.live_consumption
  for select using (auth.uid() = user_id);

commit;
