-- Live figures for the landing page.
--
-- The hero showed "4,700+ Opportunities" and "1,700+ Companies" as text typed
-- into the page. On 9 Oct 2026 the catalogue held 2,996 visible listings from
-- far fewer companies, so the page overstated both. This function returns the
-- real numbers, counted the same way search does: Published or Closing Soon,
-- with no deadline or a deadline still ahead.
--
-- SECURITY INVOKER: it reads only rows the caller may already read (the
-- "Public can view active opportunities" policy), so it exposes nothing new.

create or replace function public.landing_stats()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'opportunities', count(*),
    'companies', count(distinct company_id)
  )
  from public.opportunities
  where status in ('Published', 'Closing Soon')
    and (deadline is null or deadline >= now());
$$;

revoke execute on function public.landing_stats() from public;
grant execute on function public.landing_stats() to anon, authenticated, service_role;
