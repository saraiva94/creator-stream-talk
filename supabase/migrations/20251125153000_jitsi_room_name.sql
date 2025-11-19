-- Rename legacy Daily room column to the generic Jitsi room slug
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lives'
      AND column_name = 'daily_room_name'
  ) THEN
    ALTER TABLE public.lives
      RENAME COLUMN daily_room_name TO room_name;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lives'
      AND column_name = 'room_name'
  ) THEN
    ALTER TABLE public.lives
      ADD COLUMN room_name text;
  END IF;
END $$;

-- Remove unused Daily-specific room metadata
DROP POLICY IF EXISTS "Creators view their room info" ON public.daily_rooms;
DROP POLICY IF EXISTS "Service role manages rooms" ON public.daily_rooms;
DROP POLICY IF EXISTS "Service role updates rooms" ON public.daily_rooms;

DROP INDEX IF EXISTS daily_rooms_live_id_idx;
DROP INDEX IF EXISTS daily_rooms_room_name_idx;

DROP TABLE IF EXISTS public.daily_rooms;
