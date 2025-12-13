-- Create table for homepage carousel settings
CREATE TABLE public.homepage_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  carousel_card_count INTEGER NOT NULL DEFAULT 7 CHECK (carousel_card_count IN (1, 3, 5, 7)),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.homepage_settings (id, carousel_card_count) VALUES ('default', 7);

-- Enable RLS
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings
CREATE POLICY "Everyone can view homepage settings"
ON public.homepage_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Only admins can update settings
CREATE POLICY "Only admins can update homepage settings"
ON public.homepage_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));