-- Schema Migration v1
-- Purpose: Safely add structured fields for 2000+ scaling without breaking existing UI
-- Target Table: opportunities

-- 1. Structured Geography
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS city text;

-- 2. Extended Requirements and Sourcing
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS requirements text[];
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_url text;

-- (Note: Existing 'location' and 'skills' columns are preserved exactly as-is to ensure 100% UI backwards compatibility)
