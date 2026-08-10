-- Migration: hub_images_and_edit
-- Adds image attachments and message editing to the Hub, plus the storage
-- bucket + policies images are uploaded to. Idempotent throughout.

-- ── Columns ───────────────────────────────────────────────────────────────────

alter table public.hub_messages
  add column if not exists image_url    text,
  add column if not exists image_width  int,
  add column if not exists image_height int,
  add column if not exists edited_at    timestamptz;

-- A message must have real text, or an image, or both — but never neither,
-- and text (when present) still respects the original length ceiling.
alter table public.hub_messages drop constraint if exists hub_messages_content_check;
alter table public.hub_messages add constraint hub_messages_content_check
  check (
    char_length(content) <= 2000
    and (image_url is not null or char_length(trim(content)) >= 1)
  );

-- ── RLS: editing ──────────────────────────────────────────────────────────────
-- The original migration granted UPDATE at the table level (see
-- hub_messages_grants.sql) but never added a row-level policy for it, so
-- every update was silently blocked by RLS regardless of the grant.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hub_messages'
      and policyname = 'hub_messages_update'
  ) then
    execute $p$
      create policy hub_messages_update
        on public.hub_messages
        for update
        to authenticated
        using (sender_id = auth.uid())
        with check (sender_id = auth.uid());
    $p$;
  end if;
end
$$;

-- ── Storage: hub-attachments ─────────────────────────────────────────────────
-- Public bucket, same trust model as `avatars`: anyone authenticated can view
-- (the Hub chat itself is already readable by every authenticated user), but
-- a user may only write into their own uid-prefixed folder.

insert into storage.buckets (id, name, public)
values ('hub-attachments', 'hub-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Hub attachments are publicly accessible." on storage.objects;
drop policy if exists "Users can upload their own hub attachments." on storage.objects;
drop policy if exists "Users can delete their own hub attachments." on storage.objects;

create policy "Hub attachments are publicly accessible."
on storage.objects for select
using ( bucket_id = 'hub-attachments' );

create policy "Users can upload their own hub attachments."
on storage.objects for insert
with check (
  bucket_id = 'hub-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own hub attachments."
on storage.objects for delete
using (
  bucket_id = 'hub-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
