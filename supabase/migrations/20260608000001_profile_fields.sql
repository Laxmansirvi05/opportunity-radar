-- Add missing profile fields based on PRD requirements
ALTER TABLE public.profiles
ADD COLUMN career_goal TEXT,
ADD COLUMN resume_name TEXT,
ADD COLUMN resume_size INTEGER,
ADD COLUMN resume_updated_at TIMESTAMPTZ;
