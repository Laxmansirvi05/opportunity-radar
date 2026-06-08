-- 1. Fix Profiles RLS for upsert
-- Need to drop the old insert policy if we want to replace, but we just add a new one
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Fix Bookmarks and Tracker foreign keys to reference auth.users
ALTER TABLE bookmarks
  DROP CONSTRAINT bookmarks_user_id_fkey,
  ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE application_tracker
  DROP CONSTRAINT application_tracker_user_id_fkey,
  ADD CONSTRAINT application_tracker_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
