-- Migration: note_preview_view
--
-- The folder browser draws up to 5 note previews per folder. Doing that from
-- the notes table directly would mean selecting `content` for every note the
-- user owns and throwing almost all of it away — a rich document runs to tens
-- of kilobytes, so a student with a few hundred notes would be downloading
-- megabytes to render a grid of folder cards.
--
-- This view returns only what a preview needs: the first 400 characters of
-- the document, plus the first inline image's URL extracted in Postgres
-- (which the truncation would otherwise cut in half).
--
-- security_invoker = true so the view is read as the querying user and the
-- notes table's own RLS policies still apply — a view is otherwise evaluated
-- as its owner, which would hand every user everyone else's notes.

create or replace view public.note_preview_rows
with (security_invoker = true) as
select
  n.id,
  n.user_id,
  n.folder_id,
  n.title,
  left(n.content, 400)                                as preview_html,
  substring(n.content from '<img[^>]+src="([^"]+)"')  as first_image_url,
  n.updated_at,
  n.is_pinned
from public.notes n
where n.deleted_at is null
  and n.is_archived = false;

grant select on public.note_preview_rows to authenticated;
grant select on public.note_preview_rows to service_role;

-- Per-folder note counts.
--
-- PostgREST's embedded `notes(count)` would count trashed and archived notes
-- too unless the embed is filtered, and a wrong count is worse than no count
-- — a folder reading "12 notes" that opens to 4 is exactly the class of bug
-- APP-16 was (a real number with nothing behind it). Grouping in SQL makes
-- the count and the folder view provably read the same rows.

create or replace view public.note_folder_counts
with (security_invoker = true) as
select
  n.user_id,
  n.folder_id,
  count(*)::int as note_count
from public.notes n
where n.deleted_at is null
  and n.is_archived = false
  and n.folder_id is not null
group by n.user_id, n.folder_id;

grant select on public.note_folder_counts to authenticated;
grant select on public.note_folder_counts to service_role;
