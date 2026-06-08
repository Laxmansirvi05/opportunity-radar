-- 20260608160701_fix_table_grants.sql

-- Grant permissions to authenticated role for core tables missing from init_schema.sql
GRANT ALL ON public.application_tracker TO authenticated;
GRANT ALL ON public.bookmarks TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.reports TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

-- Grant permissions to anon role (required for PostgREST even if RLS blocks access, but we'll stick to minimum needed)
GRANT SELECT ON public.application_tracker TO anon;
GRANT SELECT ON public.bookmarks TO anon;
