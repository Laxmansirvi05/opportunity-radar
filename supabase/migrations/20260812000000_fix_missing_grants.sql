-- Migration: fix_missing_grants
--
-- Two tables were created without the GRANTs a working feature needs.
-- RLS restricts *which* rows a role can touch; it does nothing without a
-- base table GRANT first — a table with RLS policies but no GRANT is
-- unreachable by everyone, policies or not.
--
-- 1. notifications: only `authenticated` was ever granted anything
--    (20260608160701_fix_table_grants.sql). `service_role` has none, so
--    every service-role write — including the nightly deadline-alert
--    cron — fails outright. That cron has been returning 500 every
--    night as a result.
-- 2. achievements (20260809121000_achievements.sql): shipped with RLS
--    policies for `authenticated` (all four operations, gated on
--    auth.uid()) but zero GRANT statements of any kind. Verified live:
--    `service_role` gets `permission denied for table achievements`
--    (Postgres error 42501) on a plain SELECT. The RLS policies were
--    never reachable by anyone.
--
-- Idempotent: GRANT is safe to re-run.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated, service_role;
