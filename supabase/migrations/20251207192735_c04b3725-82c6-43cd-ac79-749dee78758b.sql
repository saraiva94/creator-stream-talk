-- Allow users to create subscriptions (follow)
CREATE POLICY "Users can create subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own subscriptions (unfollow)
CREATE POLICY "Users can update own subscriptions"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id);