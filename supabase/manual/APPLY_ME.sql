-- ============================================================
-- Opportunity Radar — pending schema changes
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- Safe to run more than once (all statements are idempotent).
-- ============================================================

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

-- ============================================================================
-- AI Search jobs
--
-- The matching agent is a background pipeline: 5–20 minutes per run, one job at
-- a time. That is far past any serverless request budget, so a run cannot live
-- inside an HTTP call. This table is the handle.
--
-- It also supplies the authorization the agent itself does not have. Per the
-- agent's integration guide: "No per-user authorization. Anyone holding a
-- job_id can read that job." Binding job_id to a user here means our API can
-- refuse to poll a job that is not the caller's, and a student can close the
-- tab and come back to a run in progress.
--
-- Strictly additive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_search_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The agent's own job handle. Unique so a retry cannot fork one run.
    agent_job_id    TEXT NOT NULL UNIQUE,

    -- processing | complete | failed
    status          TEXT NOT NULL DEFAULT 'processing',

    -- Verbatim agent payload once complete. Kept whole rather than shredded
    -- into columns: the contract has ~20 fields per opportunity, most nullable,
    -- and the UI is required to render what is present and omit what is not.
    result          JSONB,

    -- {code, message} from a failed run.
    error           JSONB,

    resume_filename TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- "Show me my latest run" is the only query the UI makes.
CREATE INDEX IF NOT EXISTS idx_ai_search_jobs_user_created
  ON public.ai_search_jobs(user_id, created_at DESC);

-- The poller looks jobs up by the agent's handle.
CREATE INDEX IF NOT EXISTS idx_ai_search_jobs_agent_job
  ON public.ai_search_jobs(agent_job_id);

ALTER TABLE public.ai_search_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own AI search jobs" ON public.ai_search_jobs;
CREATE POLICY "Users can view their own AI search jobs"
  ON public.ai_search_jobs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own AI search jobs" ON public.ai_search_jobs;
CREATE POLICY "Users can create their own AI search jobs"
  ON public.ai_search_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own AI search jobs" ON public.ai_search_jobs;
CREATE POLICY "Users can update their own AI search jobs"
  ON public.ai_search_jobs FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_ai_search_jobs_updated_at ON public.ai_search_jobs;
CREATE TRIGGER trigger_ai_search_jobs_updated_at
  BEFORE UPDATE ON public.ai_search_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_search_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_search_jobs TO authenticated;
