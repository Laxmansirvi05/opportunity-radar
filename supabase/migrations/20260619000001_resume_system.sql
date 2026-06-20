-- =============================================================================
-- Migration: Resume System (TDD-001)
-- Adds: resumes table, resume_status enum, RLS, v_student_ats_inputs view
-- Depends on: profiles table (existing)
-- =============================================================================

-- Status enum
CREATE TYPE resume_status AS ENUM (
  'uploaded',
  'parsing',
  'review_required',
  'verified',
  'failed'
);

-- Resumes table
CREATE TABLE resumes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url                    TEXT NOT NULL,
  file_name                   TEXT,
  parsed_data                 JSONB DEFAULT '{}',
  -- Denormalised skill columns for fast ATS/Rec Engine queries (Change 2)
  extracted_skills            TEXT[] DEFAULT '{}',
  extracted_project_keywords  TEXT[] DEFAULT '{}',
  status                      resume_status NOT NULL DEFAULT 'uploaded',
  error_message               TEXT,
  is_master                   BOOLEAN DEFAULT false,
  -- Freshness tracking (Change 3, stored only, not scored in MVP)
  resume_updated_at           TIMESTAMPTZ DEFAULT NOW(),
  resume_last_reviewed_at     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resumes_user_id   ON resumes(user_id);
CREATE INDEX idx_resumes_status    ON resumes(status);
CREATE INDEX idx_resumes_user_verified ON resumes(user_id, status) WHERE status = 'verified';
CREATE INDEX idx_resumes_ext_skills    ON resumes USING gin(extracted_skills);
CREATE INDEX idx_resumes_proj_kws      ON resumes USING gin(extracted_project_keywords);

-- Add primary_resume_id to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS primary_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;

-- Trigger: auto-update updated_at + resume_updated_at
CREATE OR REPLACE FUNCTION update_resume_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Only bump resume_updated_at when parsed_data or extracted columns actually change
  IF (OLD.parsed_data IS DISTINCT FROM NEW.parsed_data)
     OR (OLD.extracted_skills IS DISTINCT FROM NEW.extracted_skills) THEN
    NEW.resume_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resumes_timestamps
  BEFORE UPDATE ON resumes
  FOR EACH ROW EXECUTE FUNCTION update_resume_timestamps();

-- Row Level Security
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resumes_select_own" ON resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "resumes_insert_own" ON resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resumes_update_own" ON resumes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "resumes_delete_own" ON resumes
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass (for server-side operations)
CREATE POLICY "resumes_service_role" ON resumes
  FOR ALL USING (auth.role() = 'service_role');

-- Resume versions table (TDD-004, non-destructive edits)
CREATE TABLE resume_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_resume_id  UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  label           TEXT,
  parsed_data     JSONB NOT NULL,
  changes         JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resume_versions_user ON resume_versions(user_id, created_at DESC);
CREATE INDEX idx_resume_versions_base ON resume_versions(base_resume_id);

ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versions_own" ON resume_versions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "versions_service_role" ON resume_versions
  FOR ALL USING (auth.role() = 'service_role');

-- Denormalised view for ATS Engine and Recommendation Engine fast reads
CREATE OR REPLACE VIEW v_student_ats_inputs AS
SELECT
  p.id                              AS user_id,
  p.interests,
  r.id                              AS resume_id,
  r.extracted_skills,
  r.extracted_project_keywords,
  r.parsed_data -> 'experience'     AS experience_json,
  r.parsed_data -> 'education'      AS education_json,
  r.resume_updated_at,
  r.resume_last_reviewed_at
FROM profiles p
JOIN resumes r ON r.id = p.primary_resume_id
WHERE r.status = 'verified';

GRANT SELECT ON v_student_ats_inputs TO authenticated;
