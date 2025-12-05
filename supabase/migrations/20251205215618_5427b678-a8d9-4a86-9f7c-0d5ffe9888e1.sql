-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Participants are viewable by everyone" ON public.room_participants;

-- Create more restrictive policies:

-- 1. Room creators can view all participants in their rooms
CREATE POLICY "Room creators can view participants"
ON public.room_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = room_participants.room_id
    AND rooms.creator_id = auth.uid()
  )
);

-- 2. Users can view their own participation records
CREATE POLICY "Users can view own participation"
ON public.room_participants
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Authenticated users can view participants in rooms they are also in (for chat/interaction purposes)
CREATE POLICY "Participants can view other participants in same room"
ON public.room_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = room_participants.room_id
    AND rp.user_id = auth.uid()
  )
);