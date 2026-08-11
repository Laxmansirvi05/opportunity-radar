-- =============================================================================
-- Migration: Enhanced Application Tracker (TDD-005)
-- Adds: applications (5-stage Kanban), application_events (timeline)
-- Note: Existing application_tracker table is preserved. This is the V2 table.
-- Depends on: profiles (existing), opportunities (existing), resumes (001)
-- =============================================================================

CREATE TYPE application_stage AS ENUM (
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived'
);

-- V2 Applications table (replaces application_tracker semantically; keeps both for migration safety)
CREATE TABLE applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id        UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  stage                 application_stage NOT NULL DEFAULT 'saved',

  -- Score snapshots — captured at 'applied' stage, never recalculated
  ats_score_snapshot    INT,
  match_score_snapshot  INT,
  resume_version_id     UUID REFERENCES resume_versions(id) ON DELETE SET NULL,

  -- Metadata
  applied_at            TIMESTAMPTZ,
  notes                 TEXT,
  custom_label          TEXT,

  -- Kanban column ordering (gap strategy: multiples of 100)
  column_position       INT NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, opportunity_id)
);

CREATE INDEX idx_applications_user_stage   ON applications(user_id, stage);
CREATE INDEX idx_applications_user_created ON applications(user_id, created_at DESC);
CREATE INDEX idx_applications_opp          ON applications(opportunity_id);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_applications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_applications_updated
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_applications_timestamp();

-- Timeline / audit log
CREATE TABLE application_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  -- Valid event_types: 'stage_change', 'note_added', 'note_edited', 'score_snapshot'
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_events_application ON application_events(application_id, created_at ASC);
CREATE INDEX idx_app_events_user        ON application_events(user_id, created_at DESC);

-- RLS: applications
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_own" ON applications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "applications_service" ON applications
  FOR ALL USING (auth.role() = 'service_role');

-- RLS: application_events
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_own" ON application_events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "events_service" ON application_events
  FOR ALL USING (auth.role() = 'service_role');

-- Helper RPC: get full board for a user (grouped by stage)
CREATE OR REPLACE FUNCTION get_application_board(p_user_id UUID)
RETURNS TABLE (
  id                    UUID,
  stage                 application_stage,
  column_position       INT,
  applied_at            TIMESTAMPTZ,
  notes                 TEXT,
  custom_label          TEXT,
  ats_score_snapshot    INT,
  match_score_snapshot  INT,
  opportunity_id        UUID,
  opportunity_title     TEXT,
  opportunity_company   UUID,
  opportunity_location  TEXT,
  opportunity_is_paid   BOOLEAN,
  opportunity_deadline  TEXT,
  opportunity_apply_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.stage,
    a.column_position,
    a.applied_at,
    a.notes,
    a.custom_label,
    a.ats_score_snapshot,
    a.match_score_snapshot,
    a.opportunity_id,
    o.title            AS opportunity_title,
    o.company_id       AS opportunity_company,
    o.location         AS opportunity_location,
    o.is_paid          AS opportunity_is_paid,
    o.deadline::TEXT   AS opportunity_deadline,
    o.apply_url        AS opportunity_apply_url
  FROM applications a
  JOIN opportunities o ON o.id = a.opportunity_id
  WHERE a.user_id = p_user_id
    AND a.stage != 'archived'
  ORDER BY a.stage, a.column_position ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_application_board TO authenticated;
