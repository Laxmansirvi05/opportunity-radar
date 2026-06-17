-- Add ingested_at column
ALTER TABLE opportunities ADD COLUMN ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill ingested_at with created_at for historical records
UPDATE opportunities SET ingested_at = created_at;

-- Make posted_at nullable and remove DEFAULT NOW()
ALTER TABLE opportunities ALTER COLUMN posted_at DROP DEFAULT;
ALTER TABLE opportunities ALTER COLUMN posted_at DROP NOT NULL;
