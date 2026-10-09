-- Auth helper functions: callable by the server only.
--
-- 20260830000000_auth_security.sql granted EXECUTE on these to `anon` and
-- `authenticated`. They are SECURITY DEFINER and exposed through PostgREST, so
-- that grant let anyone holding the public anon key call them directly:
--
--   * log_login_attempt(email, ip, false) five times locks any account out for
--     15 minutes, because check_login_rate_limit counts failures by email.
--   * log_email_resend() does the same to the verification-email cooldown.
--   * check_user_confirmed() and login_hint_for_email() answer "does this email
--     have an account, and how does it sign in" for any address.
--
-- None of them is called from the browser. features/auth/actions/auth-actions.ts
-- runs on the server and now uses the service-role client for all six, so the
-- public grants are not needed.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.log_login_attempt(text, text, boolean)',
    'public.check_login_rate_limit(text, text)',
    'public.log_email_resend(text, text)',
    'public.check_email_resend_cooldown(text, text)',
    'public.check_user_confirmed(text)',
    'public.login_hint_for_email(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- The two log tables have RLS enabled and no policies, which already denies
-- anon/authenticated. Drop the table grants too so the intent is explicit.
revoke all on table public.login_attempts from anon, authenticated;
revoke all on table public.email_resend_logs from anon, authenticated;
grant select, insert, delete on table public.login_attempts to service_role;
grant select, insert, delete on table public.email_resend_logs to service_role;
