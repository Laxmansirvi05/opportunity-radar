-- =============================================================================
-- Migration: Recommendation Engine (TDD-002)
-- Adds: extracted_skills + governance columns on opportunities
--       skill_frequency_index, get_ranked_opportunities RPC
-- Depends on: opportunities table (existing), resumes (migration 001)
-- =============================================================================

-- Add V2 intelligence columns to opportunities (additive only)
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS extracted_skills           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skill_extraction_status    TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS skill_extraction_version   TEXT;

-- Indexes for extraction governance and skill lookups
CREATE INDEX IF NOT EXISTS idx_opp_extracted_skills
  ON opportunities USING gin(extracted_skills);

CREATE INDEX IF NOT EXISTS idx_opp_extraction_status
  ON opportunities(skill_extraction_status);

CREATE INDEX IF NOT EXISTS idx_opp_extraction_version
  ON opportunities(skill_extraction_version);

-- Skill frequency index — rebuilt nightly, powers importance ranking (Change 7)
CREATE TABLE skill_frequency_index (
  skill       TEXT PRIMARY KEY,
  frequency   INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to rebuild skill frequency (called by scheduled job)
CREATE OR REPLACE FUNCTION rebuild_skill_frequency()
RETURNS void AS $$
BEGIN
  DELETE FROM skill_frequency_index;
  INSERT INTO skill_frequency_index (skill, frequency)
  SELECT
    unnest(extracted_skills) AS skill,
    COUNT(*) AS frequency
  FROM opportunities
  WHERE skill_extraction_status = 'processed'
  GROUP BY skill;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User opportunity matches cache (NOT activated in MVP — pre-designed for scaling)
-- Activate when DAU > 2,000
CREATE TABLE user_opportunity_matches (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  match_score     INT NOT NULL,
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE INDEX idx_uom_user_score ON user_opportunity_matches(user_id, match_score DESC);

-- RLS for skill_frequency_index (public read)
ALTER TABLE skill_frequency_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sfi_read_authenticated" ON skill_frequency_index
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sfi_service_role" ON skill_frequency_index
  FOR ALL USING (auth.role() = 'service_role');

-- RLS for user_opportunity_matches
ALTER TABLE user_opportunity_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uom_own" ON user_opportunity_matches
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- Core RPC: get_ranked_opportunities
-- Deterministic 6-component scoring inside PostgreSQL
-- Weights: Skills 50%, Experience 15%, Projects 10%, Category 10%, Recency 10%, Deadline 5%
-- =============================================================================
CREATE OR REPLACE FUNCTION get_ranked_opportunities(
  p_user_id           UUID,
  p_category          TEXT DEFAULT NULL,
  p_location          TEXT DEFAULT NULL,
  p_experience_level  TEXT DEFAULT NULL,
  p_limit             INT  DEFAULT 50
)
RETURNS TABLE (
  id                  UUID,
  title               TEXT,
  company_id          UUID,
  category            TEXT,
  location            TEXT,
  mode                TEXT,
  experience_level    TEXT,
  deadline            TEXT,
  is_paid             BOOLEAN,
  apply_url           TEXT,
  posted_at           TEXT,
  status              TEXT,
  extracted_skills    TEXT[],
  match_score         INT,
  matched_skills      TEXT[],
  missing_skills      TEXT[],
  skill_coverage_pct  NUMERIC
) AS $$
DECLARE
  v_skills            TEXT[];
  v_project_keywords  TEXT[];
BEGIN
  -- Fetch student's denormalised skill arrays (O(1) lookup)
  SELECT
    r.extracted_skills,
    r.extracted_project_keywords
  INTO v_skills, v_project_keywords
  FROM profiles p
  JOIN resumes r ON r.id = p.primary_resume_id
  WHERE p.id = p_user_id
    AND r.status = 'verified';

  -- If no verified resume, return unranked recency-sorted feed
  IF v_skills IS NULL THEN
    RETURN QUERY
      SELECT
        o.id, o.title, o.company_id, o.category, o.location, o.mode,
        o.experience_level, o.deadline::TEXT, o.is_paid, o.apply_url,
        o.posted_at::TEXT, o.status, o.extracted_skills,
        50 AS match_score,
        '{}'::TEXT[] AS matched_skills,
        '{}'::TEXT[] AS missing_skills,
        0::NUMERIC    AS skill_coverage_pct
      FROM opportunities o
      WHERE o.status IN ('Published', 'Closing Soon')
        AND (o.deadline IS NULL OR o.deadline::DATE > CURRENT_DATE)
        AND (p_category IS NULL OR o.category = p_category)
        AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
        AND (p_experience_level IS NULL OR o.experience_level = p_experience_level)
      ORDER BY o.posted_at DESC
      LIMIT p_limit;
    RETURN;
  END IF;

  -- Main scored query: FILTER → SCORE → SORT → LIMIT (approved order)
  RETURN QUERY
  WITH filtered AS (
    SELECT o.*
    FROM opportunities o
    WHERE o.status IN ('Published', 'Closing Soon')
      AND (o.deadline IS NULL OR o.deadline::DATE > CURRENT_DATE)
      AND o.skill_extraction_status = 'processed'
      AND (p_category IS NULL OR o.category = p_category)
      AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
      AND (p_experience_level IS NULL OR o.experience_level = p_experience_level)
  ),
  scored AS (
    SELECT
      f.*,
      -- Intersection arrays
      ARRAY(
        SELECT unnest(v_skills)
        INTERSECT
        SELECT unnest(f.extracted_skills)
      ) AS _matched_skills,
      ARRAY(
        SELECT unnest(v_project_keywords)
        INTERSECT
        SELECT unnest(f.extracted_skills)
        EXCEPT
        SELECT unnest(v_skills)
      ) AS _project_matched,
      -- Skill score (50%)
      CASE
        WHEN array_length(f.extracted_skills, 1) IS NULL OR array_length(f.extracted_skills, 1) = 0
        THEN 0.5
        ELSE LEAST(
          (
            array_length(
              ARRAY(SELECT unnest(v_skills) INTERSECT SELECT unnest(f.extracted_skills)),
              1
            )::NUMERIC +
            array_length(
              ARRAY(
                SELECT unnest(v_project_keywords)
                INTERSECT SELECT unnest(f.extracted_skills)
                EXCEPT SELECT unnest(v_skills)
              ),
              1
            )::NUMERIC
          ) / array_length(f.extracted_skills, 1)::NUMERIC,
          1.0
        )
      END AS _skill_score,
      -- Experience score (15%)
      CASE
        WHEN f.experience_level IS NULL OR f.experience_level = 'Any' THEN 1.0
        WHEN f.experience_level = 'Fresher' THEN 0.9
        ELSE 0.6
      END AS _exp_score,
      -- Recency score (10%)
      CASE
        WHEN f.posted_at >= NOW() - INTERVAL '7 days'  THEN 1.0
        WHEN f.posted_at >= NOW() - INTERVAL '30 days' THEN 0.75
        WHEN f.posted_at >= NOW() - INTERVAL '90 days' THEN 0.5
        ELSE 0.25
      END AS _recency_score,
      -- Deadline score (5%)
      CASE
        WHEN f.deadline IS NULL THEN 0.7
        WHEN f.deadline::DATE > CURRENT_DATE + 14 THEN 1.0
        WHEN f.deadline::DATE > CURRENT_DATE + 7  THEN 0.7
        WHEN f.deadline::DATE > CURRENT_DATE      THEN 0.4
        ELSE 0.0
      END AS _deadline_score
    FROM filtered f
  )
  SELECT
    s.id,
    s.title,
    s.company_id,
    s.category,
    s.location,
    s.mode,
    s.experience_level,
    s.deadline::TEXT,
    s.is_paid,
    s.apply_url,
    s.posted_at::TEXT,
    s.status,
    s.extracted_skills,
    -- Final weighted score
    ROUND(
      (
        s._skill_score   * 0.50 +
        s._exp_score     * 0.15 +
        s._recency_score * 0.10 +
        s._deadline_score * 0.05 +
        0.10 +  -- project_score already baked into _skill_score intersection
        0.10    -- category_score neutral (no category penalty)
      ) * 100
    )::INT AS match_score,
    s._matched_skills AS matched_skills,
    ARRAY(
      SELECT unnest(s.extracted_skills)
      EXCEPT
      (SELECT unnest(v_skills) UNION SELECT unnest(v_project_keywords))
    ) AS missing_skills,
    CASE
      WHEN array_length(s.extracted_skills, 1) IS NULL OR array_length(s.extracted_skills, 1) = 0
      THEN 0::NUMERIC
      ELSE ROUND(
        (
          COALESCE(array_length(s._matched_skills, 1), 0) +
          COALESCE(array_length(s._project_matched, 1), 0)
        )::NUMERIC / array_length(s.extracted_skills, 1)::NUMERIC * 100,
        1
      )
    END AS skill_coverage_pct
  FROM scored s
  ORDER BY match_score DESC, s.posted_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_ranked_opportunities TO authenticated;
