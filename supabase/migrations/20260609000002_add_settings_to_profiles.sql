-- Add settings columns to profiles
ALTER TABLE public.profiles ADD COLUMN email_alerts BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE public.profiles ADD COLUMN public_profile BOOLEAN DEFAULT false NOT NULL;
