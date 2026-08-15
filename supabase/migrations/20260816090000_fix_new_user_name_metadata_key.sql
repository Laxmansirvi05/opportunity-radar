-- Fix: handle_new_user() read raw_user_meta_data->>'name', but the signup
-- form (features/auth/actions/auth-actions.ts) has only ever sent the
-- "Full Name" field under the key 'full_name'. Every signup since this
-- trigger was created therefore fell through the COALESCE to
-- split_part(email, '@', 1) — every new student's display name across the
-- app (dashboard greeting, Hub chat, profile) silently became their email's
-- local-part instead of the name they typed at signup.
--
-- Found 16 Aug 2026 audit: a fresh signup with full_name = 'Audit Tester'
-- produced profiles.name = 'laxmansirvi2203+audit20260816' (the email
-- prefix), confirmed live against auth.users.raw_user_meta_data vs. the
-- resulting profiles row.
--
-- Fixed by checking 'full_name' first (what the form actually sends),
-- falling back to 'name' (in case any other future signup path uses that
-- key instead), then the email prefix as the last resort. Idempotent
-- (CREATE OR REPLACE), no data migration for existing rows — a student may
-- have already edited their display name via Settings since signing up,
-- and there's no way to distinguish that from an unedited email-prefix
-- default, so existing rows are left alone.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            NULLIF(NEW.raw_user_meta_data->>'name', ''),
            split_part(NEW.email, '@', 1)
        ),
        'student'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
