-- Add ingestion_logs table
CREATE TABLE IF NOT EXISTS public.ingestion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    records_processed INT DEFAULT 0,
    records_inserted INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_rejected INT DEFAULT 0,
    records_skipped_dup INT DEFAULT 0,
    execution_time_ms INT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to ingestion_logs"
    ON public.ingestion_logs
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Service role is used for inserts during the cron job, which bypasses RLS naturally.
