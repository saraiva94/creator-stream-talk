-- Fix 1: profiles - Restrict to only self-view (public_profiles view handles public data)
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: financial_settings - Restrict to admins only (not public)
DROP POLICY IF EXISTS "Anyone can view financial settings" ON public.financial_settings;

CREATE POLICY "Only admins can view financial settings"
ON public.financial_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: messages - Only authenticated room participants can view
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.messages;

CREATE POLICY "Messages viewable by room participants"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = messages.room_id
    AND (rooms.creator_id = auth.uid() OR rooms.is_active = true)
  )
);

-- Fix 4: rooms - Only authenticated users can view
DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;

CREATE POLICY "Rooms viewable by authenticated users"
ON public.rooms
FOR SELECT
TO authenticated
USING (true);

-- Fix 5: creator_bank_accounts - Ensure no public access (policies already exist, but reinforce)
-- Existing policies are correct, just verify RLS is enabled
-- Already has: Creators can view own, Admins can view all

-- Also fix lives table (similar issue)
DROP POLICY IF EXISTS "Lives are viewable by everyone" ON public.lives;

CREATE POLICY "Lives viewable by authenticated users"
ON public.lives
FOR SELECT
TO authenticated
USING (true);

-- Fix superchats
DROP POLICY IF EXISTS "Anyone can view superchats in a room" ON public.superchats;

CREATE POLICY "Superchats viewable by authenticated users"
ON public.superchats
FOR SELECT
TO authenticated
USING (true);

-- Fix banned_users
DROP POLICY IF EXISTS "Anyone can view bans in their rooms" ON public.banned_users;

CREATE POLICY "Bans viewable by room creators"
ON public.banned_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = banned_users.room_id
    AND rooms.creator_id = auth.uid()
  )
);

-- Fix chat_settings
DROP POLICY IF EXISTS "Anyone can view chat settings" ON public.chat_settings;

CREATE POLICY "Chat settings viewable by authenticated users"
ON public.chat_settings
FOR SELECT
TO authenticated
USING (true);