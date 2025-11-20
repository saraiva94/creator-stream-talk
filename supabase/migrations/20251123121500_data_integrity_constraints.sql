begin;

-- Remove duplicate live access entries before enforcing uniqueness
with duplicates as (
  select live_id, user_id, ctid,
         row_number() over (partition by live_id, user_id order by ctid) as rn
  from public.live_access
)
delete from public.live_access la
using duplicates d
where la.ctid = d.ctid
  and d.rn > 1;

alter table public.live_access
  add constraint live_access_live_user_key unique (live_id, user_id);

-- Remove duplicate commission entries before enforcing uniqueness
with commission_duplicates as (
  select payment_id, creator_id, ctid,
         row_number() over (partition by payment_id, creator_id order by ctid) as rn
  from public.commissions
)
delete from public.commissions c
using commission_duplicates d
where c.ctid = d.ctid
  and d.rn > 1;

alter table public.commissions
  add constraint commissions_payment_creator_key unique (payment_id, creator_id);

-- Normalize withdrawal statuses and enforce allowed values
update public.withdrawals
set status = coalesce(nullif(lower(status), ''), 'pending')
where status is distinct from coalesce(nullif(lower(status), ''), 'pending');

alter table public.withdrawals
  alter column status set default 'pending';

alter table public.withdrawals
  add constraint withdrawals_status_check
    check (status in ('pending', 'approved', 'rejected', 'paid'));

-- Remove duplicate webhook events before enforcing uniqueness
with webhook_duplicates as (
  select idempotency_key, ctid,
         row_number() over (partition by idempotency_key order by ctid) as rn
  from public.webhook_events
)
delete from public.webhook_events w
using webhook_duplicates d
where w.ctid = d.ctid
  and d.rn > 1;

alter table public.webhook_events
  add constraint webhook_events_idempotency_key_key unique (idempotency_key);

commit;
