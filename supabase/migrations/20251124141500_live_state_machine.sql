-- Enforce the live state machine and normalize current data
ALTER TABLE public.lives
  ALTER COLUMN status SET DEFAULT 'scheduled';

UPDATE public.lives
SET status = 'scheduled'
WHERE status IS NULL;

ALTER TABLE public.lives
  DROP CONSTRAINT IF EXISTS lives_status_check;

ALTER TABLE public.lives
  ADD CONSTRAINT lives_status_check
  CHECK (status IN (
    'scheduled',
    'waiting_for_host',
    'live',
    'inactive',
    'ending',
    'ended'
  ));

CREATE INDEX IF NOT EXISTS lives_status_idx ON public.lives(status);

UPDATE public.lives
SET is_active = false
WHERE status IN ('scheduled', 'ended');

UPDATE public.lives
SET is_active = true
WHERE status IN ('waiting_for_host', 'live', 'inactive', 'ending');
