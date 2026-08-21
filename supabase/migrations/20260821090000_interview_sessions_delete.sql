-- Let a student delete their own interview.
--
-- interview_sessions shipped with SELECT / INSERT / UPDATE policies and a
-- matching grant, but nothing for DELETE — so "delete this report" was not
-- merely missing from the UI, it was impossible: the grant would have been
-- refused, and even with the grant the row would have matched no policy and
-- the delete would have silently affected zero rows.
--
-- interview_reports.session_id is ON DELETE CASCADE (see
-- 20260812010000_interview_feature.sql), so removing the session removes its
-- report with it. No separate policy is needed on interview_reports for the
-- cascade, which runs with the referencing table's rights.
--
-- Scoped to the owner exactly like the other three policies on this table.

GRANT DELETE ON public.interview_sessions TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can delete their own interview sessions"
  ON public.interview_sessions FOR DELETE USING (auth.uid() = user_id);
