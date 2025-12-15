-- ===========================================
-- RLS Policies for Anonymous Viewer Access
-- ===========================================

-- 1. Lives: Already has "Lives are viewable by everyone" policy, but let's ensure it's correct
-- (No change needed - lives already has public SELECT)

-- 2. Messages: Allow anonymous to read messages from active rooms
CREATE POLICY "Anonymous can view messages in active rooms"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rooms 
    WHERE rooms.id = messages.room_id 
    AND rooms.is_active = true
  )
);

-- 3. Profiles: Allow anonymous to read basic profile info (username, avatar)
-- Using public_profiles view is safer, but let's add a direct policy for profiles
CREATE POLICY "Anyone can view basic profile info"
ON public.profiles
FOR SELECT
USING (true);

-- 4. Creator profiles: Already has "Creator profiles viewable by everyone" policy
-- (No change needed)

-- 5. Superchats: Allow anonymous to view superchats in active rooms
CREATE POLICY "Anonymous can view superchats in active rooms"
ON public.superchats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rooms 
    WHERE rooms.id = superchats.room_id 
    AND rooms.is_active = true
  )
);

-- 6. Rooms: Allow anonymous to view active rooms (for chat lookup)
CREATE POLICY "Anyone can view active rooms"
ON public.rooms
FOR SELECT
USING (is_active = true);

-- 7. Chat settings: Allow anonymous to read chat settings
CREATE POLICY "Anyone can view chat settings"
ON public.chat_settings
FOR SELECT
USING (true);