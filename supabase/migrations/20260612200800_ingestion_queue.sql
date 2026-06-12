-- Add ingestion_queue table
CREATE TABLE IF NOT EXISTS public.ingestion_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    UNIQUE(source, source_id)
);

-- Indexes for efficient polling and deduplication
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_status ON public.ingestion_queue(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_created_at ON public.ingestion_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_processed_at ON public.ingestion_queue(processed_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_source_source_id ON public.ingestion_queue(source, source_id);

-- Add automatic updated_at trigger
CREATE TRIGGER trigger_update_ingestion_queue_updated_at
BEFORE UPDATE ON public.ingestion_queue
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE public.ingestion_queue ENABLE ROW LEVEL SECURITY;

-- Security Note:
-- Unlike ingestion_logs (which allows read access to authenticated users),
-- the ingestion_queue contains raw internal backend state and pre-published URLs.
-- Therefore, NO policies are created. 
-- RLS will default-deny all access from the public and authenticated roles.
-- The discovery cron and background worker will use the service_role key, 
-- which automatically bypasses RLS for all operations.
