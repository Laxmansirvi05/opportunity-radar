-- Tell the login screen when an email belongs to a social-only account.
--
-- Supabase returns the SAME "Invalid login credentials" error for a wrong
-- password and for an email that was only ever registered through Google (no
-- password was ever set). That left our Google-first users at a dead end:
-- their account exists, password login can never succeed, and the generic
-- error gives them no hint to use "Continue with Google" instead.
--
-- This SECURITY DEFINER function reads auth.users / auth.identities (which the
-- anon role cannot read directly) and returns only a coarse "how do you sign
-- in" hint — never whether a given password is correct. The login action calls
-- it ONLY after signInWithPassword has already failed, to turn that dead end
-- into an actionable message.
--
-- Tradeoff: returning 'google'/'oauth' does reveal that an address is
-- registered (email enumeration), which Supabase's default auth deliberately
-- hides. That is an accepted tradeoff for this project, which has also disabled
-- email confirmation so friends can sign in with any address. An unknown email
-- yields no row (null), so it stays indistinguishable from a password account.

create or replace function public.login_hint_for_email(p_email text)
returns text
language sql
security definer
set search_path = ''
as $$
  select case
    when u.encrypted_password is not null and u.encrypted_password <> ''
      then 'password'
    when exists (
      select 1 from auth.identities i
      where i.user_id = u.id and i.provider = 'google'
    ) then 'google'
    when exists (
      select 1 from auth.identities i where i.user_id = u.id
    ) then 'oauth'
    else 'password'
  end
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.login_hint_for_email(text) from public;
grant execute on function public.login_hint_for_email(text) to anon, authenticated;
