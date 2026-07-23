-- Explicit per-operation policies make ownership guarantees clear for the
-- Reactive Resume integration and protect both direct Supabase access and the
-- Next.js server-action/API paths.

DROP POLICY IF EXISTS "Users can manage their own resumes" ON public.resumes;
CREATE POLICY "Users can select their own resumes"
  ON public.resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own resumes"
  ON public.resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own resumes"
  ON public.resumes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own resumes"
  ON public.resumes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own resume ats reports" ON public.resume_ats_reports;
CREATE POLICY "Users can select their own resume ats reports"
  ON public.resume_ats_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_ats_reports.resume_id AND resumes.user_id = auth.uid()));
CREATE POLICY "Users can insert their own resume ats reports"
  ON public.resume_ats_reports FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_ats_reports.resume_id AND resumes.user_id = auth.uid()));
CREATE POLICY "Users can update their own resume ats reports"
  ON public.resume_ats_reports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_ats_reports.resume_id AND resumes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_ats_reports.resume_id AND resumes.user_id = auth.uid()));
CREATE POLICY "Users can delete their own resume ats reports"
  ON public.resume_ats_reports FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.resumes WHERE resumes.id = resume_ats_reports.resume_id AND resumes.user_id = auth.uid()));
