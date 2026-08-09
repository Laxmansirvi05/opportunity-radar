-- ============================================================================
-- Resume Optimization
--
-- Extends the existing (created but never used) resume_optimizations table into
-- the store for a full optimisation run: the baseline score, the derived
-- suggestions with their completion state, and the two generated resumes with
-- their own independently-measured scores.
--
-- Persistence is the point. A student is told to build a project, then returns
-- days or weeks later to tick it off and download the target resume. The run
-- must survive logout.
--
-- Strictly additive: no column is dropped and no existing data is modified.
-- The two NOT NULL constraints are relaxed because a run now exists from the
-- moment scoring completes, long before either resume has been generated —
-- and for a strong resume, neither ever will be.
-- ============================================================================

ALTER TABLE public.resume_optimizations
  -- Direct ownership. The original policy reached through resumes.user_id,
  -- which breaks for a run started from an inline (unsaved) resume.
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The target this run was optimised against.
  ADD COLUMN IF NOT EXISTS job_description  TEXT,
  ADD COLUMN IF NOT EXISTS company_name     TEXT,
  ADD COLUMN IF NOT EXISTS target_role      TEXT,

  -- The uploaded resume, as parsed, so a run is reproducible even if the
  -- source resume row is later edited or deleted.
  ADD COLUMN IF NOT EXISTS source_resume    JSONB,

  -- Score of the resume as uploaded, and the full report behind it.
  ADD COLUMN IF NOT EXISTS baseline_score   SMALLINT,
  ADD COLUMN IF NOT EXISTS baseline_report  JSONB,

  -- full | polish_only | already_strong — which branch the baseline triggered.
  ADD COLUMN IF NOT EXISTS tier             TEXT,

  -- [{ id, type, title, detail, requirement, importance, completed, completed_at }]
  -- `completed` is the checklist state that gates the target resume.
  ADD COLUMN IF NOT EXISTS suggestions      JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Resume A — same facts, better structure and wording. Always downloadable.
  ADD COLUMN IF NOT EXISTS polished_resume  JSONB,
  ADD COLUMN IF NOT EXISTS polished_score   SMALLINT,

  -- Resume B — aligned to the job description, incorporating the suggestions.
  -- Its score is a projection: it only becomes true once the suggested work is
  -- genuinely done, which is what the checklist enforces.
  ADD COLUMN IF NOT EXISTS target_resume    JSONB,
  ADD COLUMN IF NOT EXISTS target_score     SMALLINT,

  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- A run is created before anything is generated, so these can no longer be
-- required at insert time.
ALTER TABLE public.resume_optimizations ALTER COLUMN optimized_data   DROP NOT NULL;
ALTER TABLE public.resume_optimizations ALTER COLUMN changes_summary  DROP NOT NULL;

-- The source resume may be inline rather than a saved row.
ALTER TABLE public.resume_optimizations ALTER COLUMN original_resume_id DROP NOT NULL;

ALTER TABLE public.resume_optimizations
  DROP CONSTRAINT IF EXISTS resume_optimizations_tier_check;
ALTER TABLE public.resume_optimizations
  ADD CONSTRAINT resume_optimizations_tier_check
  CHECK (tier IS NULL OR tier IN ('full', 'polish_only', 'already_strong'));

-- "Show me my runs, newest first" is the only listing query.
CREATE INDEX IF NOT EXISTS idx_resume_optimizations_user_created
  ON public.resume_optimizations(user_id, created_at DESC);

-- ── Ownership ───────────────────────────────────────────────────────────────
-- The original policy joined through resumes; that cannot express ownership of
-- a run started from an inline resume. Replaced with a direct user_id check.

DROP POLICY IF EXISTS "Users can manage their own resume optimizations" ON public.resume_optimizations;

DROP POLICY IF EXISTS "Users can view their own optimizations" ON public.resume_optimizations;
CREATE POLICY "Users can view their own optimizations"
  ON public.resume_optimizations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own optimizations" ON public.resume_optimizations;
CREATE POLICY "Users can create their own optimizations"
  ON public.resume_optimizations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own optimizations" ON public.resume_optimizations;
CREATE POLICY "Users can update their own optimizations"
  ON public.resume_optimizations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own optimizations" ON public.resume_optimizations;
CREATE POLICY "Users can delete their own optimizations"
  ON public.resume_optimizations FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_resume_optimizations_updated_at ON public.resume_optimizations;
CREATE TRIGGER trigger_resume_optimizations_updated_at
  BEFORE UPDATE ON public.resume_optimizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_optimizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_optimizations TO authenticated;
