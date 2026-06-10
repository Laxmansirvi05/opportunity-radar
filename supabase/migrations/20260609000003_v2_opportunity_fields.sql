-- Safe Additive Migration for Phase 1B
-- Do not drop any columns to preserve backwards compatibility.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS source_id TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requirements TEXT[],
ADD COLUMN IF NOT EXISTS remote BOOLEAN,
ADD COLUMN IF NOT EXISTS salary_range TEXT,
ADD COLUMN IF NOT EXISTS employment_type TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Note: 'apply_url' and 'last_verified_at' already exist in the original schema.
