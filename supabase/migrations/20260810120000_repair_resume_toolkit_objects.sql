-- ============================================================================
-- Repair: resume-toolkit objects that never reached production
--
-- 20260626000000_resume_toolkit_v2.sql created four things: the `resumes`
-- table, `resume_ats_reports`, `resume_optimizations`, and the `resume-toolkit`
-- storage bucket. Only `resumes` exists in production, so that migration was
-- applied partially or by hand and the rest was lost.
--
-- It cannot simply be replayed: its first statement is a bare
-- `CREATE TABLE public.resumes` with no IF NOT EXISTS, which now fails and
-- aborts the transaction before reaching anything else.
--
-- This migration creates only what is missing, idempotently, so it is safe to
-- run against any environment — including one where the original did apply.
--
-- Verified missing on 2026-08-10 via pg_class:
--   resume_ats_reports, resume_optimizations, bucket 'resume-toolkit'
-- Symptom this fixes: /api/resume/picture returned 500 on every upload,
-- because it writes to a bucket that did not exist.
-- ============================================================================

-- ── resume_ats_reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resume_ats_reports (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id              UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    target_job_description TEXT,
    score                  INTEGER NOT NULL,
    report_data            JSONB NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.resume_ats_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own resume ats reports" ON public.resume_ats_reports;
CREATE POLICY "Users can manage their own resume ats reports"
    ON public.resume_ats_reports
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.resumes
            WHERE resumes.id = resume_ats_reports.resume_id
              AND resumes.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_ats_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_ats_reports TO authenticated;

-- ── resume_optimizations (base shape) ───────────────────────────────────────
-- 20260810090000_resume_optimization.sql extends this table with ADD COLUMN
-- IF NOT EXISTS, so it must exist first or that migration aborts.
CREATE TABLE IF NOT EXISTS public.resume_optimizations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
    optimized_data     JSONB,
    changes_summary    JSONB,
    status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.resume_optimizations ENABLE ROW LEVEL SECURITY;

-- ── resume-toolkit storage bucket ───────────────────────────────────────────
-- Private: it holds resume profile photos, which are personal data.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resume-toolkit', 'resume-toolkit', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-scoped access. The route writes to `<user_id>/pictures/<uuid>.<ext>`,
-- so the first path segment is the owning user.
DROP POLICY IF EXISTS "Users can upload their own resume toolkit files" ON storage.objects;
CREATE POLICY "Users can upload their own resume toolkit files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view their own resume toolkit files" ON storage.objects;
CREATE POLICY "Users can view their own resume toolkit files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own resume toolkit files" ON storage.objects;
CREATE POLICY "Users can update their own resume toolkit files"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own resume toolkit files" ON storage.objects;
CREATE POLICY "Users can delete their own resume toolkit files"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1]);
