-- Add thumbnail_url column to lives table for custom live thumbnails
ALTER TABLE public.lives 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;