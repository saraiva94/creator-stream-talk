-- Create avatars storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create live-thumbnails storage bucket for live stream thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-thumbnails',
  'live-thumbnails',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Anyone can view live thumbnails (public bucket)
CREATE POLICY "Live thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'live-thumbnails');

-- Policy: Creators can upload their own live thumbnails
CREATE POLICY "Creators can upload live thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'live-thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Creators can update their own live thumbnails
CREATE POLICY "Creators can update live thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'live-thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Creators can delete their own live thumbnails
CREATE POLICY "Creators can delete live thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'live-thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);