-- Add email tracking to enforce single invite usage per email
alter table public.registration_referrals
  add column if not exists email text;

create index if not exists registration_referrals_email_idx
  on public.registration_referrals (lower(email));
