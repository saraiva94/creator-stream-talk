begin;

-- Ensure payout requests can store PIX information for payouts
alter table public.payout_requests
  add column if not exists pix_key text;

-- Add admin-controlled approval flag for going live
alter table public.creator_profiles
  add column if not exists approved_for_live boolean not null default false;

update public.creator_profiles
set approved_for_live = coalesce(approved_for_live, false)
where approved_for_live is null;

create or replace function public.enforce_creator_live_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.role() <> 'service_role' then
    new.approved_for_live := false;
  end if;

  if tg_op = 'UPDATE' and auth.role() <> 'service_role' then
    if coalesce(new.approved_for_live, false) is distinct from coalesce(old.approved_for_live, false) then
      raise exception 'Only admins can change live approval';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists creator_profiles_approved_for_live_guard on public.creator_profiles;

create trigger creator_profiles_approved_for_live_guard
  before insert or update on public.creator_profiles
  for each row
  execute function public.enforce_creator_live_approval_guard();

commit;
