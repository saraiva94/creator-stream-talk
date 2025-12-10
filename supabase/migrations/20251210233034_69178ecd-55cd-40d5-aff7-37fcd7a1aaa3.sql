-- Create content_reports table for moderation system
CREATE TABLE public.content_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  live_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports"
ON public.content_reports
FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Users can view own reports
CREATE POLICY "Users can view own reports"
ON public.content_reports
FOR SELECT
USING (auth.uid() = reporter_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.content_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update reports
CREATE POLICY "Admins can update reports"
ON public.content_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for rooms table (for viewer count updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;