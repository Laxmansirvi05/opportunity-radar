-- Add pg_trgm extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_location_trgm ON opportunities USING gin (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_opportunities_category_trgm ON opportunities USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_opportunities_title_trgm ON opportunities USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_at ON opportunities(posted_at DESC);

-- Drop the function if it already exists
DROP FUNCTION IF EXISTS search_opportunities_rpc;

-- Create the RPC function
CREATE OR REPLACE FUNCTION search_opportunities_rpc(
  search_query text DEFAULT NULL,
  filter_category text[] DEFAULT NULL,
  filter_mode text[] DEFAULT NULL,
  filter_experience_level text[] DEFAULT NULL,
  filter_is_paid boolean DEFAULT NULL,
  filter_location text DEFAULT NULL,
  filter_freshness_interval interval DEFAULT NULL,
  filter_deadline_min timestamp with time zone DEFAULT NULL,
  filter_deadline_max timestamp with time zone DEFAULT NULL,
  sort_by text DEFAULT 'relevance',
  page_offset integer DEFAULT 0,
  page_limit integer DEFAULT 20
) RETURNS TABLE (
  id uuid,
  title text,
  location text,
  category text,
  mode text,
  experience_level text,
  is_paid boolean,
  status text,
  posted_at timestamp with time zone,
  deadline timestamp with time zone,
  company_id uuid,
  apply_url text,
  company_name text,
  company_logo_url text,
  company_website_url text,
  tag_names text[],
  total_count bigint
) AS $$
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
    -- A simple combination of text search
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
    search_query,           -- $1
    filter_category,        -- $2
    filter_mode,            -- $3
    filter_experience_level,-- $4
    filter_is_paid,         -- $5
    filter_location,        -- $6
    filter_freshness_interval, -- $7
    filter_deadline_min,    -- $8
    filter_deadline_max,    -- $9
    page_limit,             -- $10
    page_offset;            -- $11
END;
$$ LANGUAGE plpgsql;
