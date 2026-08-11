-- ============================================================================
-- AI Voice Interview
--
-- Mirrors the ai_search_jobs pattern exactly: DeepInterview (a separate,
-- externally-deployed Python service — see docs/VOICE-INTERVIEW-INTEGRATION.md
-- and docs/AI-FEATURES-HANDOFF.md §3) does the actual work and holds its own
-- session state. This table is our handle on it — the authorization the
-- agent's own API does not have (its session ids are unguessable but not
-- ownership-checked), and the local record that lets a student's interview
-- history survive independently of the external service.
--
-- interview_sessions.opportunity_id is ON DELETE SET NULL, not CASCADE:
-- Opportunity Radar hard-deletes expired opportunities nightly, and a
-- student's interview history must survive the listing disappearing.
--
-- interview_reports stores the ScoreCard verbatim (JSONB) rather than
-- shredded into columns, same reasoning as ai_search_jobs.result: the shape
-- has many nullable fields (competency_scores, strengths, weaknesses,
-- model_answers, language_report, next_steps, summary) and the UI is
-- required to render what is present and omit what is not, not fabricate
-- placeholders for what's missing.
--
-- Retention: 30 days, mirroring the AI Search agent's own recommended
-- policy for pipeline_jobs (its SECURITY.md §8) — not yet enforced by a
-- cron here, same as that one isn't either. Voice recordings/transcripts
-- are more sensitive than a resume; do not let this silently become
-- "indefinite" the way pipeline_jobs did.
--
-- Strictly additive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Nullable: a student may practise standalone, without a specific listing.
    opportunity_id    UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    resume_id         UUID REFERENCES public.resumes(id) ON DELETE SET NULL,

    role_title        TEXT,
    company           TEXT,

    -- pending | in_progress | completed | failed | abandoned
    -- Distinct from the external agent's own status vocabulary (see
    -- app/api/interview/[sessionId]/route.ts for the translation) — this is
    -- what Opportunity Radar's own UI branches on.
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','failed','abandoned')),

    -- The session id on the DeepInterview side. Unique so a retry cannot
    -- fork one run onto two local rows.
    external_session_id TEXT UNIQUE,

    started_at        TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ,
    duration_seconds  INT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_created
  ON public.interview_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_external
  ON public.interview_sessions(external_session_id);

-- Sweep target: sessions started but never reaching a terminal status —
-- mirrors ai_search_jobs' need for a stuck-job sweep, and DeepInterview's
-- own known gap (its disconnect-triggered scoring is not reliable — see
-- OPPORTUNITY_RADAR_CORRECTIONS.md Addition 2). A periodic job should mark
-- anything in_progress past a staleness threshold as abandoned.
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status_started
  ON public.interview_sessions(status, started_at);

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can view their own interview sessions"
  ON public.interview_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can create their own interview sessions"
  ON public.interview_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can update their own interview sessions"
  ON public.interview_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_interview_sessions_updated_at ON public.interview_sessions;
CREATE TRIGGER trigger_interview_sessions_updated_at
  BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Granted at creation this time, unlike notifications/achievements —
-- see 20260812000000_fix_missing_grants.sql for why that matters.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.interview_sessions TO authenticated;

-- ── Reports ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interview_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UNIQUE, not just indexed: the GET route's `finalize()` can be entered
    -- by two overlapping status polls for the same session (the fast path —
    -- the browser's own disconnect handler — and the fallback poll can both
    -- observe "complete but not yet terminal locally" before either write
    -- commits). A plain INSERT would let both land, and the terminal-status
    -- read path's `.maybeSingle()` errors out on more than one row for the
    -- same session_id — silently hiding an already-completed interview's
    -- report forever. One report per session is the actual invariant.
    session_id      UUID NOT NULL UNIQUE REFERENCES public.interview_sessions(id) ON DELETE CASCADE,

    -- Verbatim ScoreCard from the agent's GET /api/session/{id} response.
    scorecard       JSONB NOT NULL,

    -- Shredded out of `scorecard` purely for cheap sorting/listing without
    -- parsing JSON — the source of truth is still the JSONB column.
    overall_score   NUMERIC(5,2),

    -- Whether the agent persisted this without its full narrative (its own
    -- "_degraded_scorecard" case — numbers-only when the narrative LLM call
    -- failed). Surfaced so the UI shows an honest partial-report notice
    -- instead of presenting a partial card as complete.
    degraded        BOOLEAN NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No separate index needed — the UNIQUE constraint on session_id above
-- already creates one.

ALTER TABLE public.interview_reports ENABLE ROW LEVEL SECURITY;

-- No direct user_id column — authorization goes through the parent session.
DROP POLICY IF EXISTS "Users can view their own interview reports" ON public.interview_reports;
CREATE POLICY "Users can view their own interview reports"
  ON public.interview_reports FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_reports.session_id AND s.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_reports TO service_role;
GRANT SELECT ON public.interview_reports TO authenticated;
