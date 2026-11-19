create table public.mercadopago_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('credits_purchase', 'registration', 'superchat')),
  amount_cents integer not null check (amount_cents > 0),
  details jsonb not null default '{}',
  checkout_url text,
  checkout_started_at timestamptz not null default now(),
  provider_payment_id text unique,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index mercadopago_one_registration
  on public.mercadopago_orders (user_id) where kind = 'registration';

alter table public.mercadopago_orders enable row level security;
revoke all on public.mercadopago_orders from public, anon, authenticated;
grant select, insert, update, delete on public.mercadopago_orders to service_role;

create policy "Only the server can insert Mercado Pago notifications"
  on public.notifications as restrictive for insert to anon, authenticated
  with check (type <> 'mercadopago_payment');

drop policy if exists "System can insert superchats" on public.superchats;

create function public.complete_mercadopago_order(
  p_order_id uuid, p_payment_id text, p_amount_cents integer, p_method text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  purchase public.mercadopago_orders%rowtype;
  platform_cents integer;
  creator_cents integer := 0;
  credits integer;
  wallet_id uuid;
  creator uuid;
  direct_referrer uuid;
  root_referrer uuid;
  direct_cents integer := 0;
  root_cents integer := 0;
begin
  select * into purchase from public.mercadopago_orders where id = p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if purchase.amount_cents is distinct from p_amount_cents then return 'amount_mismatch'; end if;
  if purchase.provider_payment_id = p_payment_id then return 'already_processed'; end if;
  if purchase.approved_at is not null then return 'already_paid'; end if;

  platform_cents := purchase.amount_cents;
  if purchase.kind = 'credits_purchase' then
    credits := (purchase.details->>'credits')::integer;
    perform 1 from public.profiles where id = purchase.user_id for update;
    if not found then raise exception 'Credit wallet profile missing'; end if;

    select id into wallet_id from public.credits_wallet
    where user_id = purchase.user_id or profile_id = purchase.user_id
    order by (user_id = purchase.user_id) desc nulls last, id limit 1;

    if wallet_id is null then
      insert into public.credits_wallet (user_id, profile_id, balance_credits)
      values (purchase.user_id, purchase.user_id, 0)
      on conflict do nothing;
      select id into wallet_id from public.credits_wallet
      where user_id = purchase.user_id or profile_id = purchase.user_id
      order by (user_id = purchase.user_id) desc nulls last, id limit 1;
    end if;
    update public.credits_wallet
    set user_id = purchase.user_id, balance_credits = balance_credits + credits, updated_at = now()
    where id = wallet_id;
    if not found then raise exception 'Credit wallet missing'; end if;

    insert into public.credit_purchases (profile_id, payment_id, amount_cents, credits, status)
    values (purchase.user_id, purchase.id::text, purchase.amount_cents, credits, 'completed');
  elsif purchase.kind = 'superchat' then
    creator := (purchase.details->>'creator_id')::uuid;
    creator_cents := round(purchase.amount_cents * 0.8);
    platform_cents := purchase.amount_cents - creator_cents;
    insert into public.superchats
      (room_id, user_id, creator_id, message, amount, tier, duration_seconds, payment_id)
    values (
      (purchase.details->>'room_id')::uuid, purchase.user_id, creator, purchase.details->>'message',
      purchase.amount_cents, purchase.details->>'tier', (purchase.details->>'duration')::integer, purchase.id::text
    );
    insert into public.creator_wallet (creator_id, balance_cents, total_earned_cents)
    values (creator, creator_cents, creator_cents)
    on conflict (creator_id) do update set
      balance_cents = coalesce(public.creator_wallet.balance_cents, 0) + excluded.balance_cents,
      total_earned_cents = coalesce(public.creator_wallet.total_earned_cents, 0) + excluded.total_earned_cents,
      updated_at = now();
  else
    direct_referrer := (purchase.details->>'direct_id')::uuid;
    root_referrer := (purchase.details->>'root_id')::uuid;
    if direct_referrer is not null then
      direct_cents := 100;
      perform public.increment_affiliate_earnings(direct_referrer, direct_cents);
      insert into public.referrals (referrer_id, referred_id, referral_code, commission_earned, status)
      values (direct_referrer, purchase.user_id, purchase.id::text, 1, 'completed');
    end if;
    if root_referrer is not null then
      root_cents := 50;
      perform public.increment_affiliate_earnings(root_referrer, root_cents);
    end if;
    platform_cents := purchase.amount_cents - direct_cents - root_cents;
    insert into public.affiliate_logs
      (new_user, direct_referrer, root_creator, amount_direct, amount_root, amount_platform, event_type, payment_id)
    values (
      purchase.user_id, direct_referrer, root_referrer, direct_cents, root_cents,
      platform_cents, 'REGISTRATION', purchase.id::text
    );
    update public.profiles set
      status = 'active', is_subscribed = true, referred_by = direct_referrer,
      referrer_direct = direct_referrer, referrer_root = root_referrer
    where id = purchase.user_id;
    if not found then raise exception 'Registration profile missing'; end if;
    insert into public.registration_referrals
      (payment_id, user_id, referrer_id, referrer_parent_id, status, completed_at)
    values (purchase.id::text, purchase.user_id, direct_referrer, root_referrer, 'completed', now());
  end if;

  insert into public.transactions (
    user_id, creator_id, type, amount, platform_amount, creator_amount, affiliate_amount,
    status, payment_method, external_id, metadata
  ) values (
    purchase.user_id, creator, purchase.kind, purchase.amount_cents / 100.0,
    platform_cents / 100.0, creator_cents / 100.0, (direct_cents + root_cents) / 100.0,
    'completed', p_method, purchase.id::text,
    purchase.details || jsonb_build_object('provider', 'mercadopago', 'payment_id', p_payment_id)
  );

  insert into public.platform_revenue (source_type, source_id, user_id, amount, metadata)
  values (
    purchase.kind, purchase.id::text, purchase.user_id, platform_cents,
    jsonb_build_object('gross_amount', purchase.amount_cents, 'provider', 'mercadopago', 'payment_id', p_payment_id)
  );

  insert into public.notifications (user_id, title, message, type)
  select distinct user_id, 'Pagamento aprovado no Mercado Pago',
    'Pagamento ' || p_payment_id || ' confirmado. Valor: R$ ' ||
      replace((purchase.amount_cents / 100.0)::numeric(12,2)::text, '.', ','),
    'mercadopago_payment'
  from public.user_roles where role = 'admin';

  update public.mercadopago_orders
  set provider_payment_id = p_payment_id, approved_at = now()
  where id = purchase.id;
  return 'processed';
end;
$$;

revoke all on function public.complete_mercadopago_order(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.complete_mercadopago_order(uuid, text, integer, text)
  to service_role;
