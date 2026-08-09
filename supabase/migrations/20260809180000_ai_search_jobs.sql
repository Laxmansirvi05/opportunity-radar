-- ============================================================================
-- AI Search jobs
--
-- The matching agent is a background pipeline: 5–20 minutes per run, one job at
-- a time. That is far past any serverless request budget, so a run cannot live
-- inside an HTTP call. This table is the handle.
--
-- It also supplies the authorization the agent itself does not have. Per the
-- agent's integration guide: "No per-user authorization. Anyone holding a
-- job_id can read that job." Binding job_id to a user here means our API can
-- refuse to poll a job that is not the caller's, and a student can close the
-- tab and come back to a run in progress.
--
-- Strictly additive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_search_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The agent's own job handle. Unique so a retry cannot fork one run.
    agent_job_id    TEXT NOT NULL UNIQUE,

    -- processing | complete | failed
    status          TEXT NOT NULL DEFAULT 'processing',

    -- Verbatim agent payload once complete. Kept whole rather than shredded
    -- into columns: the contract has ~20 fields per opportunity, most nullable,
    -- and the UI is required to render what is present and omit what is not.
    result          JSONB,

    -- {code, message} from a failed run.
    error           JSONB,

    resume_filename TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- "Show me my latest run" is the only query the UI makes.
CREATE INDEX IF NOT EXISTS idx_ai_search_jobs_user_created
  ON public.ai_search_jobs(user_id, created_at DESC);

-- The poller looks jobs up by the agent's handle.
CREATE INDEX IF NOT EXISTS idx_ai_search_jobs_agent_job
  ON public.ai_search_jobs(agent_job_id);

ALTER TABLE public.ai_search_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own AI search jobs" ON public.ai_search_jobs;
CREATE POLICY "Users can view their own AI search jobs"
  ON public.ai_search_jobs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own AI search jobs" ON public.ai_search_jobs;
CREATE POLICY "Users can create their own AI search jobs"
  ON public.ai_search_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own AI search jobs" ON public.ai_search_jobs;
CREATE POLICY "Users can update their own AI search jobs"
  ON public.ai_search_jobs FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_ai_search_jobs_updated_at ON public.ai_search_jobs;
CREATE TRIGGER trigger_ai_search_jobs_updated_at
  BEFORE UPDATE ON public.ai_search_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_search_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_search_jobs TO authenticated;
