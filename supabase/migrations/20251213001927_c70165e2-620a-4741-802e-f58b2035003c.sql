-- Allow anonymous (logged out) users to view public lives
DROP POLICY IF EXISTS "Lives viewable by authenticated users" ON public.lives;

CREATE POLICY "Lives are viewable by everyone"
ON public.lives
FOR SELECT
TO anon, authenticated
USING (true);

-- Grant anonymous access to lives_public view
GRANT SELECT ON public.lives_public TO anon;
GRANT SELECT ON public.lives_public TO authenticated;