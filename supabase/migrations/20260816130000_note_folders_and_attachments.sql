-- Migration: note_folders_and_attachments
-- Adds folders to Notes (create/rename/delete, notes can belong to one),
-- seeds 3 default folders for every existing user, and adds the storage
-- bucket + policies note images (including pasted screenshots) upload to.
-- Idempotent throughout.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists public.note_folders (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_folders_name_length check (char_length(trim(name)) > 0 and char_length(name) <= 60),
  constraint note_folders_user_name_unique unique (user_id, name)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists note_folders_user_idx on public.note_folders (user_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuses the update_updated_at() function already defined in
-- 20260607093005_init_schema.sql — no new trigger function needed.

drop trigger if exists trigger_update_note_folders_updated_at on public.note_folders;
create trigger trigger_update_note_folders_updated_at
  before update on public.note_folders
  for each row execute function update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.note_folders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'note_folders' and policyname = 'note_folders_select'
  ) then
    execute $p$
      create policy note_folders_select
        on public.note_folders
        for select
        to authenticated
        using (user_id = auth.uid());
    $p$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'note_folders' and policyname = 'note_folders_insert'
  ) then
    execute $p$
      create policy note_folders_insert
        on public.note_folders
        for insert
        to authenticated
        with check (user_id = auth.uid());
    $p$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'note_folders' and policyname = 'note_folders_update'
  ) then
    execute $p$
      create policy note_folders_update
        on public.note_folders
        for update
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $p$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'note_folders' and policyname = 'note_folders_delete'
  ) then
    execute $p$
      create policy note_folders_delete
        on public.note_folders
        for delete
        to authenticated
        using (user_id = auth.uid());
    $p$;
  end if;
end
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
-- RLS policies alone are unreachable without a base-table GRANT first — see
-- 20260812000000_fix_missing_grants.sql for the incident that taught this
-- codebase that lesson. Both roles granted from the start here.

grant select, insert, update, delete on public.note_folders to authenticated;
grant select, insert, update, delete on public.note_folders to service_role;

-- ── Backfill: every existing user gets 3 default folders ────────────────────
-- Idempotent via the unique(user_id, name) constraint. Users created *after*
-- this migration runs are covered instead by the folders API lazily seeding
-- the same 3 defaults the first time it sees a user with zero folders.

insert into public.note_folders (user_id, name)
select id, unnest(array['Skills', 'Opportunities', 'General']) from auth.users
on conflict (user_id, name) do nothing;

-- ── notes.folder_id ──────────────────────────────────────────────────────────
-- Nullable: a deleted folder's notes fall out to null ("Unfiled") rather than
-- being destroyed or blocking the delete.

alter table public.notes
  add column if not exists folder_id uuid references public.note_folders(id) on delete set null;

create index if not exists notes_user_folder_idx on public.notes (user_id, folder_id);

-- ── Storage: note-attachments ────────────────────────────────────────────────
-- Public bucket, same trust model as hub-attachments: readable by anyone (a
-- note image URL is only ever handed to its own owner by the API anyway),
-- but a user may only write into their own uid-prefixed folder.

insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Note attachments are publicly accessible." on storage.objects;
drop policy if exists "Users can upload their own note attachments." on storage.objects;
drop policy if exists "Users can delete their own note attachments." on storage.objects;

create policy "Note attachments are publicly accessible."
on storage.objects for select
using ( bucket_id = 'note-attachments' );

create policy "Users can upload their own note attachments."
on storage.objects for insert
with check (
  bucket_id = 'note-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own note attachments."
on storage.objects for delete
using (
  bucket_id = 'note-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
