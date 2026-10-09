-- 1. Create table for brute-force rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON public.login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at);

-- RLS for login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only accessible via service_role/RPC

-- 2. Create table for tracking email resends (cooldown)
CREATE TABLE IF NOT EXISTS public.email_resend_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_resend_logs_email_time ON public.email_resend_logs(email, sent_at);

-- RLS for email_resend_logs
ALTER TABLE public.email_resend_logs ENABLE ROW LEVEL SECURITY;
-- No policies: only accessible via service_role/RPC

-- RPC to log login attempts securely
CREATE OR REPLACE FUNCTION public.log_login_attempt(p_email TEXT, p_ip TEXT, p_success BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.login_attempts(email, ip_address, success)
    VALUES (p_email, p_ip, p_success);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- RPC to check login rate limit
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_email TEXT, p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_recent_failures INT;
BEGIN
    SELECT COUNT(*) INTO v_recent_failures
    FROM public.login_attempts
    WHERE (lower(email) = lower(p_email) OR ip_address = p_ip)
      AND success = FALSE
      AND attempted_at > NOW() - INTERVAL '15 minutes';
    
    RETURN v_recent_failures < 5;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(TEXT, TEXT) TO anon, authenticated;

-- RPC to log email resends securely
CREATE OR REPLACE FUNCTION public.log_email_resend(p_email TEXT, p_ip TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.email_resend_logs(email, ip_address)
    VALUES (p_email, p_ip);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_email_resend(TEXT, TEXT) TO anon, authenticated;

-- RPC to check email resend cooldown
CREATE OR REPLACE FUNCTION public.check_email_resend_cooldown(p_email TEXT, p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_recent_sends INT;
BEGIN
    SELECT COUNT(*) INTO v_recent_sends
    FROM public.email_resend_logs
    WHERE (lower(email) = lower(p_email) OR ip_address = p_ip)
      AND sent_at > NOW() - INTERVAL '1 minute';
    
    RETURN v_recent_sends = 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_email_resend_cooldown(TEXT, TEXT) TO anon, authenticated;


-- 3. Modify `login_hint_for_email` to gate behind failure count
CREATE OR REPLACE FUNCTION public.login_hint_for_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_recent_failures INT;
    v_result TEXT;
BEGIN
    -- Check how many failed attempts in the last 15 minutes
    SELECT COUNT(*) INTO v_recent_failures
    FROM public.login_attempts
    WHERE lower(email) = lower(p_email)
      AND success = FALSE
      AND attempted_at > NOW() - INTERVAL '15 minutes';
    
    -- Only return a hint if there have been at least 3 failed attempts
    -- This prevents rapid email enumeration
    IF v_recent_failures < 3 THEN
        RETURN 'password'; -- Return default so as not to leak info yet
    END IF;

    SELECT CASE
        WHEN u.encrypted_password IS NOT NULL AND u.encrypted_password <> ''
          THEN 'password'
        WHEN EXISTS (
          SELECT 1 FROM auth.identities i
          WHERE i.user_id = u.id AND i.provider = 'google'
        ) THEN 'google'
        WHEN EXISTS (
          SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
        ) THEN 'oauth'
        ELSE 'password'
      END INTO v_result
    FROM auth.users u
    WHERE lower(u.email) = lower(p_email)
    LIMIT 1;

    RETURN COALESCE(v_result, 'password');
END;
$$;

-- 4. RPC to check confirmed_at (for "already registered" flow)
CREATE OR REPLACE FUNCTION public.check_user_confirmed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
    FROM auth.users
    WHERE lower(email) = lower(p_email)
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_confirmed(TEXT) TO anon, authenticated;

-- 5. Add suspension flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- 6. RPC for Account Deletion (Wire to Settings UI)
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- This deletes the user from auth.users, and CASCADE takes care of profiles etc.
    -- Assuming foreign keys are set up with ON DELETE CASCADE.
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
