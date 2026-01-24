
-- Grant SELECT permissions on live_consumption_safe view to authenticated and anon roles
GRANT SELECT ON public.live_consumption_safe TO authenticated;
GRANT SELECT ON public.live_consumption_safe TO anon;

-- Also ensure the underlying live_consumption table has proper RLS for creators to see consumption on their lives
-- Create policy allowing creators to view consumption data for their own lives
DO $$
BEGIN
    -- Check if policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'live_consumption' 
        AND policyname = 'Creators can view consumption on their lives'
    ) THEN
        CREATE POLICY "Creators can view consumption on their lives"
        ON public.live_consumption
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.lives 
                WHERE lives.id = live_consumption.live_id 
                AND lives.creator_id = auth.uid()
            )
        );
    END IF;
END $$;
