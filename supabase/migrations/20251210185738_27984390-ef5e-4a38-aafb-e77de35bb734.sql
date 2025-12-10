-- Create table for promotional video view analytics
CREATE TABLE public.promo_video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.promotional_videos(id) ON DELETE CASCADE,
  user_id UUID,
  session_id TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  watch_duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.promo_video_views ENABLE ROW LEVEL SECURITY;

-- Admin can read all views
CREATE POLICY "Admins can view all promo analytics" 
ON public.promo_video_views 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can insert views (for tracking)
CREATE POLICY "Anyone can record promo views" 
ON public.promo_video_views 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for analytics queries
CREATE INDEX idx_promo_views_video_id ON public.promo_video_views(video_id);
CREATE INDEX idx_promo_views_viewed_at ON public.promo_video_views(viewed_at);
CREATE INDEX idx_promo_views_video_date ON public.promo_video_views(video_id, viewed_at);