-- Create atomic function to increment viewer count
CREATE OR REPLACE FUNCTION public.increment_viewer_count(p_creator_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.creator_profiles
  SET viewer_count = COALESCE(viewer_count, 0) + 1
  WHERE id = p_creator_id
  RETURNING viewer_count INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Create atomic function to decrement viewer count (never goes below 0)
CREATE OR REPLACE FUNCTION public.decrement_viewer_count(p_creator_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.creator_profiles
  SET viewer_count = GREATEST(COALESCE(viewer_count, 0) - 1, 0)
  WHERE id = p_creator_id
  RETURNING viewer_count INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Create function to reset viewer count (called when live ends)
CREATE OR REPLACE FUNCTION public.reset_viewer_count(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.creator_profiles
  SET viewer_count = 0
  WHERE id = p_creator_id;
END;
$$;