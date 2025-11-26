create table if not exists public.live_heartbeat (
    id uuid primary key default gen_random_uuid(),
    live_id uuid not null references public.lives(id) on delete cascade,
    creator_id uuid not null references public.creators(id) on delete cascade,
    last_heartbeat timestamptz not null,
    camera_active boolean not null default true,
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists live_heartbeat_live_id_idx on public.live_heartbeat(live_id);
create index if not exists live_heartbeat_creator_id_idx on public.live_heartbeat(creator_id);

alter table public.live_heartbeat enable row level security;

create policy "Service role manages live heartbeat" on public.live_heartbeat
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table public.lives
  add column if not exists status text not null default 'scheduled',
  add column if not exists ended_at timestamptz;

create table if not exists public.live_end_log (
    id uuid primary key default gen_random_uuid(),
    live_id uuid not null references public.lives(id) on delete cascade,
    creator_id uuid not null references public.creators(id) on delete cascade,
    reason text not null,
    ended_at timestamptz not null default timezone('utc', now())
);

create index if not exists live_end_log_live_id_idx on public.live_end_log(live_id);
create index if not exists live_end_log_creator_id_idx on public.live_end_log(creator_id);

alter table public.live_end_log enable row level security;

create policy "Creators view own live end log" on public.live_end_log
  for select using (
    exists (
      select 1 from public.creators c
      where c.id = public.live_end_log.creator_id
        and c.user_id = auth.uid()
    )
  );

create policy "Service role writes live end log" on public.live_end_log
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
