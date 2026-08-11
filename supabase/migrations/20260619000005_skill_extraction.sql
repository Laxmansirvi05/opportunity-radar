-- =============================================================================
-- Migration: Skill Extraction Pipeline (TDD-006)
-- Adds: extraction_log table, optimizer_requests table
-- Depends on: opportunities (existing + migration 002), profiles (existing)
-- =============================================================================

-- Extraction audit log — one row per extraction attempt
CREATE TABLE extraction_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL,
  -- 'deterministic' = Phase 1 (tags/skills col)
  -- 'ai'            = Phase 2 (Gemini/Groq via AI Gateway)
  provider        TEXT,
  -- 'gemini' | 'groq' | null (for deterministic phase)
  skills_found    INT NOT NULL DEFAULT 0,
  tokens_used     INT,
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_extraction_log_opp     ON extraction_log(opportunity_id);
CREATE INDEX idx_extraction_log_created ON extraction_log(created_at DESC);
CREATE INDEX idx_extraction_log_success ON extraction_log(success, created_at DESC);

ALTER TABLE extraction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extraction_log_service" ON extraction_log
  FOR ALL USING (auth.role() = 'service_role');

-- Resume Optimizer requests (audit + cost tracking)
CREATE TABLE optimizer_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  original_bullet TEXT NOT NULL,
  target_skill    TEXT,
  provider        TEXT NOT NULL,
  tokens_used     INT,
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimizer_requests_user    ON optimizer_requests(user_id, created_at DESC);
CREATE INDEX idx_optimizer_requests_created ON optimizer_requests(created_at DESC);

ALTER TABLE optimizer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optimizer_own" ON optimizer_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "optimizer_service" ON optimizer_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Helper: get daily extraction health stats (used by monitoring queries)
CREATE OR REPLACE FUNCTION get_extraction_stats()
RETURNS TABLE (
  extraction_status TEXT,
  count             BIGINT,
  percentage        NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.skill_extraction_status,
    COUNT(*) AS count,
    ROUND(COUNT(*)::NUMERIC * 100 / SUM(COUNT(*)) OVER (), 2) AS percentage
  FROM opportunities o
  GROUP BY o.skill_extraction_status;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_extraction_stats TO authenticated;
