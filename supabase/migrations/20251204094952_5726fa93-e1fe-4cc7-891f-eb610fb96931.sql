-- Allow admins to update creator_profiles (for approval)
CREATE POLICY "Admins can update creator profiles" 
ON public.creator_profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all creator profiles
CREATE POLICY "Admins can view all creator profiles" 
ON public.creator_profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow system to insert notifications
CREATE POLICY "System can update notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);