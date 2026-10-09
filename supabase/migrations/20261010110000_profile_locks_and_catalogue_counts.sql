-- 1. Profile: lock the fields a user must not set for themselves.
--
-- protect_profile_fields() already pins role, suspended_at and deleted_at for
-- non-admins. Two columns were left writable through the profile UPDATE
-- policy, both confirmed with a signed-in test account on 9 Oct 2026:
--
--   * is_suspended (added 30 Aug): a user could set and clear their own
--     suspension, which would make it worthless as a ban.
--   * email: a user could set it to any address. The Hub shows this value
--     beside their messages, and note sharing resolves recipients by it, so
--     it allowed impersonation and misdirected shares. The profile email
--     must mirror the account email, which only Supabase Auth changes.

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(public.get_user_role(), 'student') <> 'admin' then
        new.role = old.role;
        new.suspended_at = old.suspended_at;
        new.deleted_at = old.deleted_at;
        new.is_suspended = old.is_suspended;
        new.email = old.email;
    end if;

    return new;
end;
$$;

-- 2. Certifications: provider counts computed in the database.
--
-- The filter sidebar counted providers by downloading the provider column in
-- 1,000-row pages as `anon` and tallying in JavaScript. Pages that hit the 3s
-- statement timeout were skipped silently, so the cached counts came out at
-- about half the truth (Coursera 6,518 shown, 13,561 real).

create or replace function public.certification_provider_counts(p_limit integer default 24)
returns table(provider text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.provider, count(*) as total
  from public.certifications c
  where (c.link_status is null or c.link_status not in (0, 404, 410))
    and c.title !~* '^\s*\[(deprecated|depricated|retired|archived)\]'
  group by c.provider
  order by total desc, c.provider
  limit least(greatest(coalesce(p_limit, 24), 1), 100);
$$;

revoke execute on function public.certification_provider_counts(integer) from public;
grant execute on function public.certification_provider_counts(integer) to anon, authenticated, service_role;
