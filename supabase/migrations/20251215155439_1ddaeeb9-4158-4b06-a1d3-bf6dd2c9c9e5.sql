-- Add LiveKit WebRTC fields to lives table (Phase 1)
-- Keeping room_name intact for chat compatibility

-- Add chat_room_id to link with rooms table for chat
ALTER TABLE public.lives 
ADD COLUMN IF NOT EXISTS chat_room_id UUID REFERENCES public.rooms(id);

-- Add webrtc_room_name for LiveKit room identification
ALTER TABLE public.lives 
ADD COLUMN IF NOT EXISTS webrtc_room_name TEXT;

-- Add host presence tracking fields
ALTER TABLE public.lives 
ADD COLUMN IF NOT EXISTS host_joined_at TIMESTAMPTZ;

ALTER TABLE public.lives 
ADD COLUMN IF NOT EXISTS host_last_heartbeat TIMESTAMPTZ;

-- Add actual viewer count (optional, not written by client yet)
ALTER TABLE public.lives 
ADD COLUMN IF NOT EXISTS actual_viewer_count INTEGER DEFAULT 0;

-- Create index for active lives queries (used by homepage/sidebar realtime)
CREATE INDEX IF NOT EXISTS idx_lives_active_status 
ON public.lives (is_active, status) 
WHERE is_active = true AND status = 'live';

-- Create index for webrtc_room_name lookups
CREATE INDEX IF NOT EXISTS idx_lives_webrtc_room 
ON public.lives (webrtc_room_name) 
WHERE webrtc_room_name IS NOT NULL;