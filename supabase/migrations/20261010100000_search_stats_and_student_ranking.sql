-- Search: honest summary numbers, and a default order that suits students.
--
-- 1. search_opportunities_stats_rpc (new). The bar above the results showed
--    "148 Companies" for the whole catalogue (real: 291) and "28 Companies"
--    for a search with 2 results. The client counted distinct companies by
--    downloading company_id rows, which PostgREST caps at 1,000, and it
--    applied its own older filter logic rather than the one search uses.
--    This function applies exactly the same filters as
--    search_opportunities_rpc and counts in the database. Keep the two WHERE
--    builders in step when either changes.
--
-- 2. search_opportunities_rpc: the default ("relevance") order now places
--    titles that mark a senior role after the rest. See the comment at the
--    ORDER BY. Signature and return type unchanged.

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
  search_terms text[];
  safe_limit integer := least(greatest(coalesce(page_limit, 20), 0), 100);
  safe_offset integer := greatest(coalesce(page_offset, 0), 0);
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

  -- Free-text search: every word must match somewhere, but the words may
  -- match different fields. "software engineer intern" finds a row titled
  -- "Software Engineer" in category "Internship"; the previous version
  -- required the whole phrase to appear inside a single field and returned
  -- nothing for almost any multi-word query.
  IF search_query IS NOT NULL AND trim(search_query) <> '' THEN
    search_terms := ARRAY(
      SELECT '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      FROM unnest(regexp_split_to_array(trim(search_query), '\s+')) AS w
      WHERE w <> ''
      LIMIT 8
    );
    base_query := base_query || ' AND NOT EXISTS (
      SELECT 1 FROM unnest($14::text[]) AS term
      WHERE NOT (
        o.title ILIKE term OR
        o.location ILIKE term OR
        o.category ILIKE term OR
        c.name ILIKE term OR
        EXISTS (SELECT 1 FROM opportunity_tags ot WHERE ot.opportunity_id = o.id AND ot.tag_name ILIKE term)
      )
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
    final_query := final_query || ' ORDER BY f.posted_at DESC, f.id';
  ELSIF sort_by = 'deadline' THEN
    final_query := final_query || ' ORDER BY f.deadline ASC NULLS LAST, f.id';
  ELSE
    -- Default order for a student audience: roles whose title marks them as
    -- senior (senior, staff, lead, principal, manager, director, ...) sort
    -- after everything else. They made up 1,541 of 3,000 live listings and
    -- filled the first pages for an audience that mostly cannot apply to
    -- them. Nothing is hidden: they are still returned, counted and
    -- searchable, and the "newest" and "deadline" sorts are unchanged.
    final_query := final_query || ' ORDER BY f.status ASC, (f.title ~* ''\m(senior|sr|staff|lead|principal|manager|director|head|vp|architect|president)\M'') ASC, f.posted_at DESC, f.id';
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
    safe_limit,                -- $10
    safe_offset,               -- $11
    filter_company,            -- $12
    filter_tags,               -- $13
    search_terms;              -- $14
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_opportunities_stats_rpc(
  search_query text DEFAULT NULL::text,
  filter_category text[] DEFAULT NULL::text[],
  filter_mode text[] DEFAULT NULL::text[],
  filter_experience_level text[] DEFAULT NULL::text[],
  filter_is_paid boolean DEFAULT NULL::boolean,
  filter_location text DEFAULT NULL::text,
  filter_freshness_interval interval DEFAULT NULL::interval,
  filter_deadline_min timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_deadline_max timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_company text DEFAULT NULL::text,
  filter_tags text[] DEFAULT NULL::text[],
  today_start timestamp with time zone DEFAULT date_trunc('day', now())
)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  base_query text;
  final_query text;
  search_terms text[];
  result json;
BEGIN
  base_query := '
    WITH filtered_opps AS (
      SELECT o.id, o.title, o.location, o.category, o.mode, o.experience_level, o.is_paid, o.status, o.posted_at, o.deadline, o.company_id, o.apply_url, o.ingested_at,
             c.name as company_name, c.logo_url as company_logo_url, c.website_url as company_website_url,
             array_remove(array_agg(t.tag_name), NULL) as tag_names
      FROM opportunities o
      LEFT JOIN companies c ON o.company_id = c.id
      LEFT JOIN opportunity_tags t ON o.id = t.opportunity_id
      WHERE o.status IN (''Published'', ''Closing Soon'')
        AND (o.deadline IS NULL OR o.deadline >= now())
  ';

  -- Free-text search: every word must match somewhere, but the words may
  -- match different fields. "software engineer intern" finds a row titled
  -- "Software Engineer" in category "Internship"; the previous version
  -- required the whole phrase to appear inside a single field and returned
  -- nothing for almost any multi-word query.
  IF search_query IS NOT NULL AND trim(search_query) <> '' THEN
    search_terms := ARRAY(
      SELECT '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      FROM unnest(regexp_split_to_array(trim(search_query), '\s+')) AS w
      WHERE w <> ''
      LIMIT 8
    );
    base_query := base_query || ' AND NOT EXISTS (
      SELECT 1 FROM unnest($14::text[]) AS term
      WHERE NOT (
        o.title ILIKE term OR
        o.location ILIKE term OR
        o.category ILIKE term OR
        c.name ILIKE term OR
        EXISTS (SELECT 1 FROM opportunity_tags ot WHERE ot.opportunity_id = o.id AND ot.tag_name ILIKE term)
      )
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

  final_query := base_query || '
    SELECT json_build_object(
      ''total'', count(*),
      ''companies'', count(DISTINCT f.company_id),
      ''posted_today'', count(*) FILTER (WHERE f.posted_at >= $15),
      ''imported_today'', count(*) FILTER (WHERE f.ingested_at >= $15)
    )
    FROM filtered_opps f
  ';

  EXECUTE final_query INTO result
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
    NULL::integer,             -- $10 (unused: paging)
    NULL::integer,             -- $11 (unused: paging)
    filter_company,            -- $12
    filter_tags,               -- $13
    search_terms,              -- $14
    today_start;               -- $15

  RETURN result;
END;
$function$;

revoke execute on function public.search_opportunities_stats_rpc(text, text[], text[], text[], boolean, text, interval, timestamptz, timestamptz, text, text[], timestamptz) from public;
grant execute on function public.search_opportunities_stats_rpc(text, text[], text[], text[], boolean, text, interval, timestamptz, timestamptz, text, text[], timestamptz) to anon, authenticated, service_role;
