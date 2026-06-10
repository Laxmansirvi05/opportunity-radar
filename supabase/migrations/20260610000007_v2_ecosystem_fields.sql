-- Safe Additive Migration for Phase 1G
-- Support for ecosystem expansion (Hackathons, Workshops, Open Source, Fellowships)

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS program_duration TEXT;
