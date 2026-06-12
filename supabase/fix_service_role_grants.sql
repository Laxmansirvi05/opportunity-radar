-- The Service Role currently lacks table-level access, which is why the 42501 permission denied error persists even with the correct service_role key.
-- Run this in your Supabase SQL Editor:

GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.opportunities TO service_role;
GRANT ALL ON public.opportunity_tags TO service_role;
GRANT ALL ON public.ingestion_logs TO service_role;

-- Ensure sequences are accessible as well
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
