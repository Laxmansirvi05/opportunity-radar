-- Rekey every storage policy from the uploader (`owner`) onto the object path.
--
-- Nine policies across two migrations were written as `auth.uid() = owner`.
-- `owner` is whoever uploaded an object, so the check says "you may touch
-- objects you uploaded" and says nothing at all about *where* they were uploaded
-- to. The rest of the project settled on the opposite convention —
-- `resume-toolkit`, `hub-attachments` and `note-attachments` all require
-- `(storage.foldername(name))[1] = auth.uid()::text` — and the application code
-- assumes that convention holds everywhere: `api/resume/upload/route.ts` writes
-- to `<user_id>/<timestamp>_<name>.pdf`, and `profile-manager.tsx` writes to
-- `<user_id>/resume.pdf` and `<user_id>/avatar.jpeg`.
--
--
-- 1. `resumes` (20260608182000) — squatting locks a user out permanently.
--
-- Because `profile-manager.tsx` uses a fixed path and `upsert: true`, an
-- authenticated attacker can upload their own file to `<victim_id>/resume.pdf`:
-- the INSERT check passes, since they are the owner of what they just uploaded.
-- The object now sits at the exact path the victim's own code targets, owned by
-- somebody else, and the victim's upsert degrades to an UPDATE that their policy
-- denies. From then on the victim cannot upload a resume, view one, or delete
-- the squatted file to recover — all three fail the `owner` test, permanently,
-- with no route out that does not involve the service role.
--
--
-- 2. `avatars` (20260607093005) — an open public file host.
--
-- These four were superseded by 20260809122000, which switched to the path
-- check. But it dropped `"Users can upload their own avatar."` while init_schema
-- had created `"Users can upload their own avatars"` — singular versus plural,
-- and a trailing period. Different names, so the drops missed and the old
-- policies are still live. RLS policies are permissive and OR'd together, so the
-- weaker one still grants: the path check never got a chance to *replace*
-- anything, it only ever added an alternative.
--
-- The consequence is worse here than for `resumes`, because 20260809122000 also
-- flipped this bucket to `public = true` and it has no size or MIME limit. Any
-- authenticated user can write any file to any path in a world-readable bucket —
-- arbitrary content, served from this project's own Supabase domain. Avatars
-- themselves are not lockable in the way resumes are (the surviving path policy
-- lets a victim overwrite a squatted avatar), so the exposure here is the open
-- upload, not the squat.
--
--
-- 3. `report-evidence` (20260607093005) — unrestricted INSERT.
--
-- Same open-upload shape, in a bucket that is at least private and read-gated to
-- admins and moderators. Nothing in the app writes to it yet; it is rekeyed here
-- so that whatever eventually does inherits the convention rather than this.
--
--
-- Deliberate consequence of all of the below: any object NOT under a `<uid>/`
-- prefix becomes unreachable for normal users, because `storage.foldername`
-- returns an empty array for a bare filename, making the subscript NULL and the
-- predicate not true. That is the fail-closed direction, it is exactly where a
-- squatted or orphaned object should land, and the service role still reaches
-- them for cleanup.

-- ---------------------------------------------------------------- resumes

drop policy if exists "Users can view their own resumes" on storage.objects;
drop policy if exists "Users can upload their own resumes" on storage.objects;
drop policy if exists "Users can update their own resumes" on storage.objects;
drop policy if exists "Users can delete their own resumes" on storage.objects;

create policy "Users can view their own resumes"
  on storage.objects for select
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own resumes"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Postgres would default the WITH CHECK from the USING expression here, so
-- stating both is not a behaviour change. It is stated anyway so that a later
-- edit to one half cannot silently widen the other — the difference between
-- these two is what decides whether a row can be renamed *out* of your folder.
create policy "Users can update their own resumes"
  on storage.objects for update
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own resumes"
  on storage.objects for delete
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- avatars

-- Dropped outright rather than rewritten: 20260809122000 already installed
-- correct path-scoped policies under the singular names, so recreating these
-- would only restore the duplicate pair that caused this.
drop policy if exists "Users can view their own avatars" on storage.objects;
drop policy if exists "Users can upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

-- -------------------------------------------------------- report-evidence

drop policy if exists "Authenticated users can upload report evidence" on storage.objects;

create policy "Authenticated users can upload report evidence"
  on storage.objects for insert
  with check (bucket_id = 'report-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
