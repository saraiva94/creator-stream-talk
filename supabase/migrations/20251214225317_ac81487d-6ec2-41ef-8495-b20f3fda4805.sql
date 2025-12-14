-- Enable realtime for lives table only (creator_profiles already enabled)
ALTER TABLE public.lives REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lives;