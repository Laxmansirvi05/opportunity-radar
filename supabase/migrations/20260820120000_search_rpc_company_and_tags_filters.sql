-- Extend search_opportunities_rpc with the two dedicated sidebar filters that
-- the Search UI already exposes but the function never supported:
--   * filter_company  — the "Company" text filter (distinct from the free-text
--                        search box), matched against companies.name.
--   * filter_tags      — the "Skills" filter; keeps a row if it carries ANY tag
--                        matching ANY selected skill (substring, case-insensitive).
--
-- Before this, adding a skill chip or typing in the Company field changed the
-- URL and rendered chips but did NOT filter results. The old 12-arg overload is
-- dropped so only this 14-arg version remains (CREATE OR REPLACE alone would
-- leave both and make no-arg calls ambiguous).

DROP FUNCTION IF EXISTS public.search_opportunities_rpc(text, text[], text[], text[], boolean, text, interval, timestamptz, timestamptz, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_opportunities_rpc(
  search_query text DEFAULT NULL::text,
  filter_category text[] DEFAULT NULL::text[],
  filter_mode text[] DEFAULT NULL::text[],
  filter_experience_level text[] DEFAULT NULL::text[],
  filter_is_paid boolean DEFAULT NULL::boolean,
  filter_location text DEFAULT NULL::text,
  filter_freshness_interval interval DEFAULT NULL::interval,
  filter_deadline_min timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_deadline_max timestamp with time zone DEFAULT NULL::timestamp with time zone,
  sort_by text DEFAULT 'relevance'::text,
  page_offset integer DEFAULT 0,
  page_limit integer DEFAULT 20,
  filter_company text DEFAULT NULL::text,
  filter_tags text[] DEFAULT NULL::text[]
)
 RETURNS TABLE(id uuid, title text, location text, category text, mode text, experience_level text, is_paid boolean, status text, posted_at timestamp with time zone, deadline timestamp with time zone, company_id uuid, apply_url text, company_name text, company_logo_url text, company_website_url text, tag_names text[], total_count bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  base_query text;
  count_query text;
  final_query text;
BEGIN
  base_query := '
    WITH filtered_opps AS (
      SELECT o.id, o.title, o.location, o.category, o.mode, o.experience_level, o.is_paid, o.status, o.posted_at, o.deadline, o.company_id, o.apply_url,
             c.name as company_name, c.logo_url as company_logo_url, c.website_url as company_website_url,
             array_remove(array_agg(t.tag_name), NULL) as tag_names
      FROM opportunities o
      LEFT JOIN companies c ON o.company_id = c.id
      LEFT JOIN opportunity_tags t ON o.id = t.opportunity_id
      WHERE o.status IN (''Published'', ''Closing Soon'')
        AND (o.deadline IS NULL OR o.deadline >= now())
  ';

  IF search_query IS NOT NULL AND trim(search_query) <> '' THEN
    base_query := base_query || ' AND (
      o.title ILIKE ''%'' || $1 || ''%'' OR
      o.location ILIKE ''%'' || $1 || ''%'' OR
      o.category ILIKE ''%'' || $1 || ''%'' OR
      c.name ILIKE ''%'' || $1 || ''%'' OR
      EXISTS (SELECT 1 FROM opportunity_tags ot WHERE ot.opportunity_id = o.id AND ot.tag_name ILIKE ''%'' || $1 || ''%'')
    )';
  END IF;

  IF filter_category IS NOT NULL THEN
    base_query := base_query || ' AND o.category = ANY($2)';
  END IF;

  IF filter_mode IS NOT NULL THEN
    base_query := base_query || ' AND o.mode = ANY($3)';
  END IF;

  IF filter_experience_level IS NOT NULL THEN
    base_query := base_query || ' AND o.experience_level = ANY($4)';
  END IF;

  IF filter_is_paid IS NOT NULL THEN
    base_query := base_query || ' AND o.is_paid = $5';
  END IF;

  IF filter_location IS NOT NULL AND trim(filter_location) <> '' THEN
    base_query := base_query || ' AND o.location ILIKE ''%'' || $6 || ''%''';
  END IF;

  IF filter_freshness_interval IS NOT NULL THEN
    base_query := base_query || ' AND o.posted_at >= (now() - $7::interval)';
  END IF;

  IF filter_deadline_min IS NOT NULL AND filter_deadline_max IS NOT NULL THEN
    base_query := base_query || ' AND o.deadline >= $8 AND o.deadline <= $9';
  END IF;

  -- Dedicated "Company" sidebar filter (distinct from the free-text search box).
  IF filter_company IS NOT NULL AND trim(filter_company) <> '' THEN
    base_query := base_query || ' AND c.name ILIKE ''%'' || $12 || ''%''';
  END IF;

  -- "Skills" sidebar filter: keep a row if it carries ANY tag matching ANY
  -- of the selected skills (substring, case-insensitive).
  IF filter_tags IS NOT NULL AND array_length(filter_tags, 1) > 0 THEN
    base_query := base_query || ' AND EXISTS (SELECT 1 FROM opportunity_tags ot2 WHERE ot2.opportunity_id = o.id AND ot2.tag_name ILIKE ANY (ARRAY(SELECT ''%'' || unnest($13::text[]) || ''%'')))';
  END IF;

  base_query := base_query || ' GROUP BY o.id, c.id )';

  count_query := base_query || ' SELECT count(*) FROM filtered_opps';

  final_query := base_query || '
    SELECT f.*, (' || count_query || ') as total_count
    FROM filtered_opps f
  ';

  IF sort_by = 'newest' THEN
    final_query := final_query || ' ORDER BY f.posted_at DESC';
  ELSIF sort_by = 'deadline' THEN
    final_query := final_query || ' ORDER BY f.deadline ASC NULLS LAST';
  ELSE
    final_query := final_query || ' ORDER BY f.status ASC, f.posted_at DESC';
  END IF;

  final_query := final_query || ' LIMIT $10 OFFSET $11';

  RETURN QUERY EXECUTE final_query
  USING
    search_query,              -- $1
    filter_category,           -- $2
    filter_mode,               -- $3
    filter_experience_level,   -- $4
    filter_is_paid,            -- $5
    filter_location,           -- $6
    filter_freshness_interval, -- $7
    filter_deadline_min,       -- $8
    filter_deadline_max,       -- $9
    page_limit,                -- $10
    page_offset,               -- $11
    filter_company,            -- $12
    filter_tags;               -- $13
END;
$function$;
