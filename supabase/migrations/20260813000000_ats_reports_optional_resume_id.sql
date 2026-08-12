-- ============================================================================
-- resume_ats_reports: allow saving a report with no saved resume row
--
-- resume_id is currently NOT NULL, so every ATS check silently failed to
-- save to history unless the resume being checked was already a saved row
-- (resumeId). A check run via "Upload PDF" (resumeData, no resumeId) has no
-- resume row to attach to and was never inserted at all — confirmed live:
-- the insert in app/api/resume/ats-check/route.ts is gated on
-- `resumeId && resumeId !== 'sample-frontend-dev'`, so that whole path was a
-- silent no-op.
--
-- resume_optimizations already solved this exact problem (original_resume_id
-- is nullable, source_resume stores the resume inline) — this mirrors that
-- pattern rather than inventing a second approach for the same problem.
-- ============================================================================

ALTER TABLE public.resume_ats_reports
  ALTER COLUMN resume_id DROP NOT NULL;

ALTER TABLE public.resume_ats_reports
  ADD COLUMN IF NOT EXISTS source_resume JSONB;

-- The RLS policies reach through resumes.user_id via resume_id, which no
-- longer covers a row with resume_id NULL. Own the row directly instead —
-- same fix resume_optimizations needed for the same reason (see
-- 20260810090000_resume_optimization.sql).
ALTER TABLE public.resume_ats_reports
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id for every existing row from its resume_id, so historical
-- reports remain visible under the new user_id-based policy below.
UPDATE public.resume_ats_reports r
SET user_id = res.user_id
FROM public.resumes res
WHERE r.resume_id = res.id
  AND r.user_id IS NULL;

DROP POLICY IF EXISTS "Users can manage their own resume ats reports" ON public.resume_ats_reports;
DROP POLICY IF EXISTS "Users can select their own resume ats reports" ON public.resume_ats_reports;
DROP POLICY IF EXISTS "Users can insert their own resume ats reports" ON public.resume_ats_reports;

CREATE POLICY "Users can manage their own resume ats reports"
  ON public.resume_ats_reports
  FOR ALL
  USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.resumes WHERE resumes.id = resume_ats_reports.resume_id AND resumes.user_id = auth.uid()
    ))
  )
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_resume_ats_reports_user_created
  ON public.resume_ats_reports(user_id, created_at DESC);
