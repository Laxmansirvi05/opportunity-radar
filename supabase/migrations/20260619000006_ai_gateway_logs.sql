-- =============================================================================
-- Migration: AI Gateway Logs (TDD-007)
-- Adds: ai_usage_log table for cost tracking, monitoring, rate limiting
-- Depends on: profiles (existing)
-- =============================================================================

CREATE TABLE ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature         TEXT NOT NULL,
  -- 'resume_parser' | 'resume_optimizer' | 'skill_extraction'
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,
  -- 'gemini' | 'groq' | 'all_failed'
  model           TEXT,
  tokens_input    INT DEFAULT 0,
  tokens_output   INT DEFAULT 0,
  tokens_total    INT DEFAULT 0,
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  failure_reason  TEXT,
  -- Estimated cost in USD at time of call
  estimated_cost  NUMERIC(10, 8) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_log_feature ON ai_usage_log(feature, created_at DESC);
CREATE INDEX idx_ai_log_user    ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_ai_log_created ON ai_usage_log(created_at DESC);
CREATE INDEX idx_ai_log_success ON ai_usage_log(success, feature, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own AI usage (for transparency)
CREATE POLICY "ai_log_own_select" ON ai_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role has full access (for rate limit checks and monitoring)
CREATE POLICY "ai_log_service" ON ai_usage_log
  FOR ALL USING (auth.role() = 'service_role');

-- Helper RPC: check if a user has exceeded rate limit for a feature
-- Called by AI Gateway before every AI request
CREATE OR REPLACE FUNCTION check_ai_rate_limit(
  p_user_id   UUID,
  p_feature   TEXT,
  p_max       INT,
  p_window_ms BIGINT  -- window in milliseconds
)
RETURNS TABLE (
  allowed   BOOLEAN,
  used      INT,
  remaining INT
) AS $$
DECLARE
  v_used  INT;
  v_start TIMESTAMPTZ;
BEGIN
  v_start := NOW() - (p_window_ms || ' milliseconds')::INTERVAL;

  SELECT COUNT(*)
  INTO v_used
  FROM ai_usage_log
  WHERE user_id = p_user_id
    AND feature  = p_feature
    AND success  = true
    AND created_at >= v_start;

  RETURN QUERY
  SELECT
    (v_used < p_max)::BOOLEAN AS allowed,
    v_used                     AS used,
    GREATEST(0, p_max - v_used) AS remaining;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_ai_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_ai_rate_limit TO service_role;

-- Daily cost monitoring view
CREATE OR REPLACE VIEW v_ai_daily_cost AS
SELECT
  DATE(created_at)        AS day,
  feature,
  provider,
  COUNT(*)                AS requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes,
  ROUND(AVG(latency_ms))  AS avg_latency_ms,
  SUM(tokens_total)       AS total_tokens,
  SUM(estimated_cost)     AS total_cost_usd
FROM ai_usage_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), feature, provider
ORDER BY day DESC, feature;

GRANT SELECT ON v_ai_daily_cost TO authenticated;
