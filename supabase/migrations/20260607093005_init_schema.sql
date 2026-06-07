-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- 1. TABLES & CONSTRAINTS
-- ==========================================

-- Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    university TEXT,
    degree TEXT,
    graduation_year INTEGER,
    skills TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    resume_url TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'moderator', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ
);

-- Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    website_url TEXT,
    careers_url TEXT,
    industry TEXT,
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opportunities
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Internship','Job','Hackathon','Workshop','Scholarship','Competition')),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    description TEXT,
    apply_url TEXT UNIQUE NOT NULL,
    location TEXT,
    mode TEXT CHECK (mode IN ('Remote','Hybrid','Onsite')),
    is_paid BOOLEAN DEFAULT FALSE,
    experience_level TEXT CHECK (experience_level IN ('Fresher','Undergrad','Masters','Any')),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending Review','Published','Closing Soon','Expired','Rejected','Archived')),
    source_type TEXT CHECK (source_type IN ('Verified','Community Sourced')),
    submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    report_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opportunity Tags
CREATE TABLE opportunity_tags (
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    PRIMARY KEY (opportunity_id, tag_name)
);

-- Bookmarks
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, opportunity_id)
);

-- Application Tracker
CREATE TABLE application_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Saved' CHECK (status IN ('Saved','Applied','Interview Scheduled','Selected','Rejected')),
    notes TEXT,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, opportunity_id)
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('DeadlineAlert','SubmissionApproved','SubmissionRejected','StaleTracker')),
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    related_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (opportunity_id, reported_by)
);

-- Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_role TEXT CHECK (actor_role IN ('admin', 'moderator', 'system')),
    action TEXT NOT NULL CHECK (action IN ('OPPORTUNITY_CREATED','OPPORTUNITY_EDITED','OPPORTUNITY_DELETED','OPPORTUNITY_EXPIRED','SUBMISSION_APPROVED','SUBMISSION_REJECTED','USER_ROLE_CHANGED','USER_SUSPENDED','USER_RESTORED','ACCOUNT_DELETED','MODERATION_ESCALATED','REPORT_RECEIVED')),
    target_type TEXT CHECK (target_type IN ('opportunity','user','company','submission','system')),
    target_id UUID,
    metadata JSONB,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. INDEXES
-- ==========================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX idx_opportunities_category ON opportunities(category);
CREATE INDEX idx_opportunities_posted_at ON opportunities(posted_at DESC);
CREATE INDEX idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX idx_opportunities_mode ON opportunities(mode);
CREATE INDEX idx_opportunities_is_paid ON opportunities(is_paid);
CREATE INDEX idx_opportunities_fts ON opportunities USING gin(to_tsvector('english', title || ' ' || coalesce(description, '')));
CREATE INDEX idx_opportunities_fresh ON opportunities(posted_at DESC, status) WHERE status = 'Published';
CREATE INDEX idx_opportunities_closing ON opportunities(deadline, status) WHERE status IN ('Published', 'Closing Soon');
CREATE INDEX idx_opportunity_tags_name ON opportunity_tags(tag_name);
CREATE INDEX idx_tracker_user_id ON application_tracker(user_id);
CREATE INDEX idx_tracker_status ON application_tracker(status);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_audit_log_performed_at ON audit_log(performed_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);

-- ==========================================
-- 3. TRIGGERS & FUNCTIONS
-- ==========================================

-- Function to handle auto-updating `updated_at` column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_opportunities_updated_at
BEFORE UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_application_tracker_updated_at
BEFORE UPDATE ON application_tracker
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to handle new user registration from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'student'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Utility Function for checking roles easily in policies and triggers
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to protect privileged profile fields from non-admin updates
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(public.get_user_role(), 'student') <> 'admin' THEN
        NEW.role = OLD.role;
        NEW.suspended_at = OLD.suspended_at;
        NEW.deleted_at = OLD.deleted_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles:
-- Users can view and edit their own profiles. Admins can view/edit all.
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id OR public.get_user_role() IN ('admin', 'moderator'));
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id OR public.get_user_role() = 'admin');
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE USING (public.get_user_role() = 'admin');

-- Companies:
-- Public read. Admin all.
CREATE POLICY "Public can view companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Admins can manage companies" ON companies FOR ALL USING (public.get_user_role() = 'admin');

-- Opportunities:
-- Public can read Published, Closing Soon, Expired. Admin/Mod can read all.
-- Students can insert (Community Submissions default to Pending Review).
CREATE POLICY "Public can view active opportunities" ON opportunities FOR SELECT USING (status IN ('Published', 'Closing Soon', 'Expired') OR public.get_user_role() IN ('admin', 'moderator'));
CREATE POLICY "Students can submit opportunities" ON opportunities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND status = 'Pending Review');
CREATE POLICY "Admins can manage opportunities" ON opportunities FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "Moderators can update opportunities" ON opportunities FOR UPDATE USING (public.get_user_role() IN ('admin', 'moderator'));

-- Opportunity Tags:
CREATE POLICY "Public can view opportunity tags" ON opportunity_tags FOR SELECT USING (true);
CREATE POLICY "Admins and Mods can manage tags" ON opportunity_tags FOR ALL USING (public.get_user_role() IN ('admin', 'moderator'));

-- Bookmarks:
-- Private to user.
CREATE POLICY "Users can view own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Application Tracker:
-- Private to user.
CREATE POLICY "Users can view own tracker" ON application_tracker FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracker" ON application_tracker FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracker" ON application_tracker FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracker" ON application_tracker FOR DELETE USING (auth.uid() = user_id);

-- Notifications:
-- Private to user.
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- Reports:
-- Authenticated users can insert. Admins/Mods can view.
CREATE POLICY "Admins and Mods can view reports" ON reports FOR SELECT USING (public.get_user_role() IN ('admin', 'moderator'));
CREATE POLICY "Authenticated users can submit reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

-- Audit Log:
-- Admins only for select. Insert only via service role (postgres system).
CREATE POLICY "Admins can view audit logs" ON audit_log FOR SELECT USING (public.get_user_role() = 'admin');

-- ==========================================
-- 5. STORAGE BUCKETS
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES 
('avatars', 'avatars', false),
('company-logos', 'company-logos', true),
('report-evidence', 'report-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Avatars RLS
CREATE POLICY "Users can view their own avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Company Logos RLS
CREATE POLICY "Public can view company logos" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');
CREATE POLICY "Admins can manage company logos" ON storage.objects FOR ALL USING (bucket_id = 'company-logos' AND public.get_user_role() = 'admin');

-- Report Evidence RLS
CREATE POLICY "Mods and Admins can view report evidence" ON storage.objects FOR SELECT USING (bucket_id = 'report-evidence' AND public.get_user_role() IN ('admin', 'moderator'));
CREATE POLICY "Authenticated users can upload report evidence" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'report-evidence' AND auth.uid() = owner);
