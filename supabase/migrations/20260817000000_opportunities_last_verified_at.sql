-- Migration: opportunities_last_verified_at
--
-- MaintenanceService's freshness step has failed on every run since it
-- shipped — all 9 logged runs are PARTIAL — because it queries
-- `opportunities.last_verified_at`, a column that was never created. The
-- failure was invisible: the log row only ever said "1 maintenance step(s)
-- encountered errors. Check server logs.", so DATA-05 was patched three times
-- without anyone seeing the cause.
--
-- The column is genuinely required by the design rather than incidental: the
-- step orders by it ascending (nulls first) so each run probes the least
-- recently verified listings and rotates through the catalogue, instead of
-- re-checking the same sample forever. Nullable with no default, so every
-- existing row sorts first and gets checked before anything already verified.

alter table public.opportunities
  add column if not exists last_verified_at timestamptz;

-- The step's own ordering key. Partial on Published/Closing Soon because those
-- are the only statuses it samples.
create index if not exists opportunities_last_verified_idx
  on public.opportunities (last_verified_at nulls first)
  where status in ('Published', 'Closing Soon');
