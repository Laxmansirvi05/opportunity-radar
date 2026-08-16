-- Migration: quick_notes_folder
--
-- Gives every existing student the Quick Notes folder that robot captures are
-- filed into. New users get it from the folders API's own default seed, and a
-- student who deletes it has it recreated on their next quick capture — so
-- this backfill is the one-time catch-up for accounts that predate it.
--
-- Idempotent via note_folders' unique(user_id, name).

insert into public.note_folders (user_id, name, color, icon, position)
select id, 'Quick Notes', 'cyan', 'bolt', 0 from auth.users
on conflict (user_id, name) do nothing;

-- Existing robot-captured notes that were never filed anywhere move in too,
-- so the folder reflects every quick capture rather than only future ones.
update public.notes n
set folder_id = f.id
from public.note_folders f
where f.user_id = n.user_id
  and f.name = 'Quick Notes'
  and n.source = 'robot'
  and n.folder_id is null
  and n.deleted_at is null;
