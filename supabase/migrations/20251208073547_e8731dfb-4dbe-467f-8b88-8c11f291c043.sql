-- Add RLS to public_profiles view
-- First, we need to enable RLS on the view (views inherit RLS from underlying tables, 
-- but we can add security by recreating the view with security_invoker)

-- Drop and recreate public_profiles view with security
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS SELECT 
  id,
  username,
  avatar_url,
  bio,
  is_subscribed,
  created_at,
  instagram_handle,
  twitter_handle,
  tiktok_handle,
  facebook_handle,
  kwai_handle,
  youtube_handle,
  website
FROM public.profiles;

-- Grant select to authenticated users only
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Drop and recreate email_queue_summary view with security
DROP VIEW IF EXISTS public.email_queue_summary;

CREATE VIEW public.email_queue_summary
WITH (security_invoker = true)
AS SELECT 
  id,
  user_id,
  email_type,
  status,
  sent_at,
  created_at
FROM public.email_queue;

-- Grant select to admins only via RLS on underlying email_queue table
REVOKE ALL ON public.email_queue_summary FROM anon;
REVOKE ALL ON public.email_queue_summary FROM authenticated;

-- Only admins should see email queue
GRANT SELECT ON public.email_queue_summary TO authenticated;

-- Add RLS policy to email_queue table if not exists
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Block public access to email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Admins can view all email queue" ON public.email_queue;
DROP POLICY IF EXISTS "System can insert email queue" ON public.email_queue;
DROP POLICY IF EXISTS "System can update email queue" ON public.email_queue;

-- Create restrictive policies for email_queue
CREATE POLICY "Block public access to email queue" 
ON public.email_queue 
FOR ALL 
USING (false)
WITH CHECK (false);

CREATE POLICY "Admins can view all email queue" 
ON public.email_queue 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert email queue" 
ON public.email_queue 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update email queue" 
ON public.email_queue 
FOR UPDATE 
USING (true);