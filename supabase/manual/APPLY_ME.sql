-- ============================================================
-- Opportunity Radar — pending schema changes
-- Paste this whole file into: Supabase Dashboard → SQL Editor → Run
-- Safe to run more than once (all statements are idempotent).
-- ============================================================

-- Add profile social/avatar fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- ============================================================================
-- Trust Engine v2
--
-- Adds the provenance and quality columns the ingestion pipeline needs in order
-- to (a) recognise what it has already seen, (b) reconcile listings that have
-- disappeared from their source, and (c) prefer official employer postings over
-- aggregator copies of the same job.
--
-- Strictly additive: no column is dropped, no existing data is modified.
-- ============================================================================

-- ── 1. Opportunity provenance & quality ─────────────────────────────────────

ALTER TABLE public.opportunities
  -- Stamped with the run timestamp every time a source still advertises this
  -- listing. Reconciliation removes anything a successful run did not see.
  ADD COLUMN IF NOT EXISTS last_seen_at    TIMESTAMPTZ,
  -- 1 = official employer ATS, 2 = official company page, 3 = aggregator.
  -- Lower wins when the same job is found twice.
  ADD COLUMN IF NOT EXISTS trust_tier      SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_remote       BOOLEAN,
  -- ISO-ish country label used to enforce the India-weighted mix.
  ADD COLUMN IF NOT EXISTS country         TEXT,
  -- apply_url with tracking params stripped and host/scheme normalised, so the
  -- same posting reached by two different URLs collapses to one row.
  ADD COLUMN IF NOT EXISTS canonical_url   TEXT,
  -- Last observed HTTP status for apply_url (NULL = never checked).
  ADD COLUMN IF NOT EXISTS link_status     SMALLINT,
  ADD COLUMN IF NOT EXISTS link_checked_at TIMESTAMPTZ;

-- Reconciliation scans by (source, last_seen_at).
CREATE INDEX IF NOT EXISTS idx_opportunities_source_last_seen
  ON public.opportunities(source, last_seen_at);

-- Link-health sweeps prioritise the least recently verified rows.
CREATE INDEX IF NOT EXISTS idx_opportunities_link_checked
  ON public.opportunities(link_checked_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_opportunities_country
  ON public.opportunities(country) WHERE country IS NOT NULL;

-- Deliberately NOT unique yet: existing rows have no canonical_url, and the
-- backfill has to resolve historical duplicates before uniqueness can be
-- enforced. A partial unique index is added in a follow-up migration once the
-- backfill is clean.
CREATE INDEX IF NOT EXISTS idx_opportunities_canonical_url
  ON public.opportunities(canonical_url) WHERE canonical_url IS NOT NULL;


-- ── 2. Source registry ──────────────────────────────────────────────────────
-- Employers are data, not code. Adding a company to the crawl is one row here
-- rather than a new provider class.

CREATE TABLE IF NOT EXISTS public.source_registry (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name         TEXT NOT NULL,
    -- Which hosted ATS serves this employer's board.
    ats                  TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','smartrecruiters','ashby','recruitee')),
    -- Board identifier within that ATS, e.g. 'postman' for Greenhouse.
    slug                 TEXT NOT NULL,
    trust_tier           SMALLINT NOT NULL DEFAULT 1,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    -- Hints the crawler to keep this board even when it yields few India rows.
    india_focus          BOOLEAN NOT NULL DEFAULT FALSE,
    last_ok_at           TIMESTAMPTZ,
    last_error           TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ats, slug)
);

CREATE INDEX IF NOT EXISTS idx_source_registry_active
  ON public.source_registry(active) WHERE active = TRUE;

ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read the source registry" ON public.source_registry;
CREATE POLICY "Anyone can read the source registry"
  ON public.source_registry FOR SELECT USING (TRUE);
-- Writes are service-role only (service_role bypasses RLS); no write policy.

DROP TRIGGER IF EXISTS trigger_source_registry_updated_at ON public.source_registry;
CREATE TRIGGER trigger_source_registry_updated_at
  BEFORE UPDATE ON public.source_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3. AI usage log ─────────────────────────────────────────────────────────
-- The AI gateway has always written here and the table never existed, so every
-- insert failed silently and the declared per-user rate limits were never
-- enforced against anything durable.

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature        TEXT NOT NULL,
    user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    provider       TEXT,
    model          TEXT,
    tokens_input   INTEGER NOT NULL DEFAULT 0,
    tokens_output  INTEGER NOT NULL DEFAULT 0,
    tokens_total   INTEGER NOT NULL DEFAULT 0,
    latency_ms     INTEGER,
    success        BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason TEXT,
    estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The rate-limit lookup is always (user, feature, recent window).
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_feature_time
  ON public.ai_usage_log(user_id, feature, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own AI usage" ON public.ai_usage_log;
CREATE POLICY "Users can view their own AI usage"
  ON public.ai_usage_log FOR SELECT USING (auth.uid() = user_id);
-- Inserts are service-role only.


-- ── 4. Durable AI rate limiting ─────────────────────────────────────────────
-- lib/ai-gateway calls this RPC and silently tolerated its absence, falling back
-- to a per-instance in-memory counter. On serverless that counter resets on
-- almost every invocation, so limits were effectively unenforced.

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
    p_user_id   UUID,
    p_feature   TEXT,
    p_max       INTEGER,
    p_window_ms BIGINT
)
RETURNS TABLE (allowed BOOLEAN, used INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_used INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_used
    FROM public.ai_usage_log
    WHERE user_id = p_user_id
      AND feature = p_feature
      AND created_at > NOW() - make_interval(secs => p_window_ms / 1000.0);

    RETURN QUERY SELECT (v_used < p_max), v_used;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(UUID, TEXT, INTEGER, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT, INTEGER, BIGINT) TO service_role;


-- ── 5. Service-role grants on user tables ───────────────────────────────────
-- These three returned HTTP 403 to the service role, which blocks maintenance
-- and admin tooling (RLS already governs what end users can see).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_tracker TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recently_viewed     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_registry     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_log        TO service_role;
