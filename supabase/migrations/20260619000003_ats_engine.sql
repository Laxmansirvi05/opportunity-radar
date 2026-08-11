-- =============================================================================
-- Migration: ATS Engine (TDD-003)
-- Adds: ats_cache table (future), skill importance view
-- Note: ATS scoring runs in TypeScript application layer (not DB)
--       Only the cache table is defined here for future activation
-- Depends on: resumes (001), opportunities (002)
-- =============================================================================

-- ATS result cache (NOT activated in MVP; pre-designed for > 1,000 DAU)
-- Activate by writing to this table in the ATS API handler
CREATE TABLE ats_cache (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  ats_score       INT NOT NULL,
  result_json     JSONB NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE INDEX idx_ats_cache_user ON ats_cache(user_id, computed_at DESC);

ALTER TABLE ats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_cache_own" ON ats_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ats_cache_service" ON ats_cache
  FOR ALL USING (auth.role() = 'service_role');

-- View: opportunity with skill importance data joined
-- Used by ATS Engine to enrich missing_skills with importance rankings
CREATE OR REPLACE VIEW v_opportunity_with_skill_importance AS
SELECT
  o.id,
  o.title,
  o.extracted_skills,
  o.experience_level,
  o.category,
  o.description,
  o.skill_extraction_status,
  -- Join skill frequency data for importance ranking
  ARRAY(
    SELECT
      jsonb_build_object(
        'skill', s,
        'frequency', COALESCE(sfi.frequency, 0),
        -- Position score: does skill appear in title?
        'in_title', (o.title ILIKE '%' || s || '%')
      )
    FROM unnest(o.extracted_skills) AS s
    LEFT JOIN skill_frequency_index sfi ON sfi.skill = s
  ) AS skills_with_frequency
FROM opportunities o
WHERE o.skill_extraction_status = 'processed';

GRANT SELECT ON v_opportunity_with_skill_importance TO authenticated;
