-- Add RLS policy to allow senders to update their own messages (for soft delete functionality)
CREATE POLICY "Senders can update own messages" 
ON public.direct_messages 
FOR UPDATE 
USING (auth.uid() = sender_id);