-- BLOCO 1: Add message types support (text, image, audio)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS duration integer;

-- Create index for faster message type filtering
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(type);

-- Enable realtime for messages if not already enabled
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Create chat-media storage bucket for images and audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 
  'chat-media', 
  true, 
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-media bucket
CREATE POLICY "Chat media is publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own chat media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- BLOCO 4: Create user_follows table for follow/unfollow functionality
CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS on user_follows
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_follows
CREATE POLICY "Users can view their own follows"
ON public.user_follows FOR SELECT
USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can follow others"
ON public.user_follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON public.user_follows FOR DELETE
USING (auth.uid() = follower_id);

-- Create user_blocks table for blocking functionality
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS on user_blocks
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_blocks
CREATE POLICY "Users can view their own blocks"
ON public.user_blocks FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON public.user_blocks FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
ON public.user_blocks FOR DELETE
USING (auth.uid() = blocker_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- Enable realtime for follows
ALTER TABLE public.user_follows REPLICA IDENTITY FULL;