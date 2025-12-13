-- Allow anonymous users to view creator profiles (needed for homepage display)
DROP POLICY IF EXISTS "Creator profiles viewable by authenticated users" ON public.creator_profiles;

CREATE POLICY "Creator profiles viewable by everyone"
ON public.creator_profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Also grant anonymous access to public_profiles view
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;