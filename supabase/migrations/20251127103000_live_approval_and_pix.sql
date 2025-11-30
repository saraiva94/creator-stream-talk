-- 20251127103000_live_approval_and_pix.sql
-- PIX payout key + compat extra para bancos que ainda usam creator_profiles

-- 1) Garantir coluna PIX no payout_requests (idempotente)
alter table public.payout_requests
  add column if not exists pix_key text;

-- 2) Compatibilidade LEGACY: só mexe em creator_profiles se a tabela existir
do $$
begin
  -- se a tabela legacy existir, aplica as regras; se não existir, não faz nada
  if to_regclass('public.creator_profiles') is not null then

    -- flag de aprovação para ir ao ar
    alter table public.creator_profiles
      add column if not exists approved_for_live boolean not null default false;

    -- garantir RLS ligado
    alter table public.creator_profiles enable row level security;

    -- policies básicas (exemplo seguro: só roda se a tabela existe)
    drop policy if exists "Users can view own profile" on public.creator_profiles;
    create policy "Users can view own profile"
      on public.creator_profiles
      for select
      using (auth.uid() = id);

    drop policy if exists "Users can update own profile" on public.creator_profiles;
    create policy "Users can update own profile"
      on public.creator_profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end
$$;
