-- Storage: stop anonymous listing of the public buckets, and enforce upload
-- limits at the bucket.
--
-- avatars, hub-attachments and note-attachments are public buckets: any
-- object is readable by its URL without a policy. They also each had a
-- `FOR SELECT USING (bucket_id = '<bucket>')` policy, which is not what
-- serves those URLs — it is what lets the Storage *list* endpoint return
-- rows. With it, anyone holding the anon key could enumerate every file in
-- all three buckets (confirmed 9 Oct 2026). Objects are stored under
-- `<user id>/…`, so the listing also disclosed user ids.
--
-- The broad SELECT policies are replaced with owner-folder ones. Signed-in
-- users still need SELECT on their own objects: the avatar upload uses
-- upsert, and remove() looks the object up before deleting it.
--
-- Public URLs are unaffected.

drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Hub attachments are publicly accessible." on storage.objects;
drop policy if exists "Note attachments are publicly accessible." on storage.objects;

drop policy if exists "Users can list their own avatar files" on storage.objects;
create policy "Users can list their own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can list their own hub attachments" on storage.objects;
create policy "Users can list their own hub attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'hub-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can list their own note attachments" on storage.objects;
create policy "Users can list their own note attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bucket-level limits. The upload routes already validate type and size, but
-- the INSERT policies let a signed-in user upload straight to Storage with
-- their own token, bypassing those routes. hub-attachments had no limit of
-- either kind. Values mirror app/api/hub/upload and app/api/notes/upload.
update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'hub-attachments';

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'text/markdown',
      'application/zip'
    ]
where id = 'note-attachments';
