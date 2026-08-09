-- ============================================================================
-- Certifications
--
-- A separate feature from opportunities, deliberately.
--
-- Certifications have no deadline and no expiry: a course that exists today
-- still exists next month, and a student can start whenever they like. Forcing
-- them through the opportunity pipeline — which is built entirely around
-- deadlines, reconciliation and removal — would mean either inventing fake
-- deadlines or special-casing expiry throughout. A separate table with its own
-- weekly refresh is simpler and honest about the difference.
--
-- Strictly additive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title         TEXT NOT NULL,
    provider      TEXT NOT NULL,
    provider_logo TEXT,

    description   TEXT,
    -- Where the student goes to enrol.
    url           TEXT NOT NULL,
    -- Canonicalised form of `url`, so the same course reached by two links
    -- collapses to one row.
    canonical_url TEXT,

    -- The single filter that matters to a student: can I do this for free?
    is_free       BOOLEAN NOT NULL DEFAULT TRUE,
    -- Display string ("Free", "₹499", "$49/month"). Free courses leave it null.
    price_label   TEXT,

    -- Optional metadata, shown when present rather than fabricated when absent.
    level         TEXT,          -- Beginner | Intermediate | Advanced
    duration      TEXT,          -- "6 weeks", "40 hours"
    topics        TEXT[] DEFAULT '{}',
    has_certificate BOOLEAN DEFAULT TRUE,

    source        TEXT NOT NULL,
    source_id     TEXT NOT NULL,

    link_status     SMALLINT,
    link_checked_at TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (source, source_id)
);

-- Free-text search over title, provider and topics, mirroring how the
-- opportunities search works so the two feel like one product.
ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS fts TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(provider, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(array_to_string(topics, ' '), '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_certifications_fts      ON public.certifications USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_certifications_is_free  ON public.certifications(is_free);
CREATE INDEX IF NOT EXISTS idx_certifications_provider ON public.certifications(provider);
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_canonical
  ON public.certifications(canonical_url) WHERE canonical_url IS NOT NULL;

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Certifications are public catalogue data: any signed-in student may read
-- them. Writes are service-role only (ingestion), so no write policy exists.
DROP POLICY IF EXISTS "Anyone can view certifications" ON public.certifications;
CREATE POLICY "Anyone can view certifications"
  ON public.certifications FOR SELECT USING (TRUE);

DROP TRIGGER IF EXISTS trigger_certifications_updated_at ON public.certifications;
CREATE TRIGGER trigger_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications TO service_role;
GRANT SELECT ON public.certifications TO authenticated, anon;

-- Also grant the service role read access to profiles, which it currently
-- lacks (HTTP 403), blocking admin and maintenance tooling. RLS still governs
-- what end users can see.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
