-- Create superchats table
CREATE TABLE public.superchats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  message TEXT NOT NULL,
  amount INTEGER NOT NULL, -- in BRL cents (300, 500, 800)
  tier TEXT NOT NULL CHECK (tier IN ('blue', 'yellow', 'red')),
  duration_seconds INTEGER NOT NULL, -- 60, 120, 180
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'displaying', 'displayed')),
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  displayed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.superchats ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view superchats in a room"
ON public.superchats FOR SELECT
USING (true);

CREATE POLICY "System can insert superchats"
ON public.superchats FOR INSERT
WITH CHECK (true);

CREATE POLICY "Creators can update superchats in their rooms"
ON public.superchats FOR UPDATE
USING (auth.uid() = creator_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.superchats;

-- Index for efficient queries
CREATE INDEX idx_superchats_room_status ON public.superchats(room_id, status);
CREATE INDEX idx_superchats_creator ON public.superchats(creator_id, status);