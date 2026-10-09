-- Certifications catalogue: index the default browse order.
--
-- The first page of /certifications runs, as the `anon` role (3s statement
-- timeout):
--
--   select ... from certifications
--   where link_status is null or link_status not in (0, 404, 410)
--   order by is_free desc, title, id
--   limit 48                       -- plus an exact count(*) of the same filter
--
-- With only idx_certifications_is_free available, Postgres walked every free
-- row (~8,200), read ~4,300 heap buffers and sorted them to return 48. Warm
-- that takes 20ms; with the pages out of cache it exceeded 3s and the request
-- failed with "canceling statement due to statement timeout" (reproduced
-- 9 Oct 2026, and visible in the build log).
--
-- This index is in the query's sort order, so the page reads ~48 entries, and
-- it carries link_status so the count can be answered from the index alone
-- instead of scanning the 56MB heap.

create index if not exists idx_certifications_browse
  on public.certifications (is_free desc, title, id)
  include (link_status);
