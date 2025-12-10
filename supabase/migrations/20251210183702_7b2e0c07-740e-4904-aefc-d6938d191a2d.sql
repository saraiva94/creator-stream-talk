-- Create promotional_videos table for admin-managed carousel ads
CREATE TABLE public.promotional_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  redirect_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.promotional_videos ENABLE ROW LEVEL SECURITY;

-- Only admins can manage promotional videos
CREATE POLICY "Admins can view all promotional videos"
ON public.promotional_videos
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert promotional videos"
ON public.promotional_videos
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update promotional videos"
ON public.promotional_videos
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete promotional videos"
ON public.promotional_videos
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can view active promotional videos (for carousel display)
CREATE POLICY "Public can view active promotional videos"
ON public.promotional_videos
FOR SELECT
USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

-- Create trigger for updated_at
CREATE TRIGGER update_promotional_videos_updated_at
  BEFORE UPDATE ON public.promotional_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();