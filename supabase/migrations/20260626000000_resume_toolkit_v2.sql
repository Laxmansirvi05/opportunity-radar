-- ==============================================================================
-- Migration: Resume Toolkit V2 (Phase 1 Foundation)
-- Description: Creates tables and storage buckets for the Resume Toolkit
-- ==============================================================================

-- 1. Create resumes table
CREATE TABLE public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user's resume slugs must be unique (for URL routing)
CREATE UNIQUE INDEX idx_resumes_user_slug ON public.resumes (user_id, slug);

-- Enable RLS for resumes
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own resumes" 
    ON public.resumes 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Trigger to update updated_at on resumes
CREATE TRIGGER update_resumes_modtime
    BEFORE UPDATE ON public.resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Create resume_ats_reports table
CREATE TABLE public.resume_ats_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    target_job_description TEXT,
    score INTEGER NOT NULL,
    report_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for resume_ats_reports
ALTER TABLE public.resume_ats_reports ENABLE ROW LEVEL SECURITY;

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

-- 3. Create resume_optimizations table
CREATE TABLE public.resume_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    optimized_data JSONB NOT NULL,
    changes_summary JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for resume_optimizations
ALTER TABLE public.resume_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own resume optimizations" 
    ON public.resume_optimizations 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.resumes 
            WHERE resumes.id = resume_optimizations.original_resume_id 
            AND resumes.user_id = auth.uid()
        )
    );

-- 4. Storage setup
-- Create resume-toolkit bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resume-toolkit', 'resume-toolkit', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload their own resume toolkit files" 
    ON storage.objects FOR INSERT 
    WITH CHECK ( bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Users can view their own resume toolkit files" 
    ON storage.objects FOR SELECT 
    USING ( bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Users can update their own resume toolkit files" 
    ON storage.objects FOR UPDATE 
    USING ( bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Users can delete their own resume toolkit files" 
    ON storage.objects FOR DELETE 
    USING ( bucket_id = 'resume-toolkit' AND auth.uid()::text = (storage.foldername(name))[1] );
