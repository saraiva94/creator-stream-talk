-- Create user_followed_tags table for users to follow themes/categories
CREATE TABLE public.user_followed_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag)
);

-- Enable RLS
ALTER TABLE public.user_followed_tags ENABLE ROW LEVEL SECURITY;

-- Users can view their own followed tags
CREATE POLICY "Users can view own followed tags"
ON public.user_followed_tags
FOR SELECT
USING (auth.uid() = user_id);

-- Users can follow tags
CREATE POLICY "Users can follow tags"
ON public.user_followed_tags
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unfollow tags
CREATE POLICY "Users can unfollow tags"
ON public.user_followed_tags
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_user_followed_tags_user_id ON public.user_followed_tags(user_id);
CREATE INDEX idx_user_followed_tags_tag ON public.user_followed_tags(tag);