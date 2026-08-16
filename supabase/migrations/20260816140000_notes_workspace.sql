-- Migration: notes_workspace
--
-- Takes Notes from "a list of notes in flat folders" to a real workspace:
-- folder identity (colour/icon), folder hierarchy and manual ordering, a
-- recoverable Trash, internal links between notes, sharing (by link and with
-- named people), and a first-class attachments record.
--
-- Idempotent throughout, same as 20260816130000_note_folders_and_attachments.sql.
--
-- One deliberate non-decision, recorded here so it isn't re-litigated later:
-- note *content* stays a single sanitised HTML string on notes.content. The
-- editor (tiptap) already serialises a full structured document — headings,
-- tables, checklists, images, code blocks, drawings — into that string
-- losslessly. Splitting it into a block table would buy nothing here and
-- would cost every read a join plus a reassembly step.

-- ── note_folders: identity, hierarchy, ordering ──────────────────────────────

alter table public.note_folders
  add column if not exists color     text    not null default 'blue',
  add column if not exists icon      text,
  add column if not exists parent_id uuid    references public.note_folders(id) on delete cascade,
  add column if not exists position  integer not null default 0;

-- The palette is constrained in the database, not just in TypeScript: a bad
-- colour would otherwise render as an unstyled folder with no clue why.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'note_folders_color_valid') then
    alter table public.note_folders
      add constraint note_folders_color_valid check (color in (
        'blue', 'cyan', 'purple', 'indigo', 'green', 'yellow',
        'orange', 'red', 'pink', 'teal', 'neutral'
      ));
  end if;
end
$$;

create index if not exists note_folders_parent_idx   on public.note_folders (parent_id);
create index if not exists note_folders_position_idx on public.note_folders (user_id, position);

-- Give the three already-seeded default folders distinct identities rather
-- than three identical blue ones. Only touches folders still on the default
-- colour, so a user who has already recoloured one keeps their choice.
update public.note_folders set color = 'purple' where name = 'Skills'        and color = 'blue';
update public.note_folders set color = 'green'  where name = 'Opportunities' and color = 'blue';
update public.note_folders set color = 'neutral' where name = 'General'      and color = 'blue';

-- ── notes: Trash ─────────────────────────────────────────────────────────────
-- Soft delete. Every browsing query filters `deleted_at is null`; Trash is
-- the one view that asks for the opposite. A hard DELETE stays available for
-- "delete permanently" and "empty trash" — but it is now always an explicit
-- choice rather than the accidental default.

alter table public.notes
  add column if not exists deleted_at timestamptz;

create index if not exists notes_user_deleted_idx on public.notes (user_id, deleted_at);

-- ── note_links: the internal knowledge graph ─────────────────────────────────
-- Polymorphic on purpose: a note can point at another note, a folder, an
-- opportunity or a tracked application, and all four are the same gesture to
-- the user ("link something"). target_id therefore carries no foreign key —
-- the read path resolves it per type and simply omits a target that no longer
-- exists, which is also what makes deleting a linked opportunity harmless.

create table if not exists public.note_links (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  source_note_id uuid        not null references public.notes(id) on delete cascade,
  target_type    text        not null check (target_type in ('note', 'folder', 'opportunity', 'application')),
  target_id      uuid        not null,
  created_at     timestamptz not null default now(),
  constraint note_links_no_self_reference check (not (target_type = 'note' and target_id = source_note_id)),
  constraint note_links_unique unique (source_note_id, target_type, target_id)
);

create index if not exists note_links_source_idx on public.note_links (source_note_id);
create index if not exists note_links_target_idx on public.note_links (target_type, target_id);

alter table public.note_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_links' and policyname='note_links_select') then
    execute $p$ create policy note_links_select on public.note_links for select to authenticated using (user_id = auth.uid()); $p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_links' and policyname='note_links_insert') then
    execute $p$ create policy note_links_insert on public.note_links for insert to authenticated with check (user_id = auth.uid()); $p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_links' and policyname='note_links_delete') then
    execute $p$ create policy note_links_delete on public.note_links for delete to authenticated using (user_id = auth.uid()); $p$;
  end if;
end
$$;

grant select, insert, update, delete on public.note_links to authenticated;
grant select, insert, update, delete on public.note_links to service_role;

-- ── note_shares: link sharing ────────────────────────────────────────────────
-- One row per shared note. `slug` is the unguessable token in the public URL.
--
-- link_access is deliberately limited to 'private' | 'view'. Anonymous *edit*
-- by link is not offered, because there is no authenticated identity to
-- attribute or rate-limit an edit to — it would be an unauthenticated write
-- endpoint against a user's own data. Editing is available through named
-- recipients below, where a real auth.uid() backs every write.

create table if not exists public.note_shares (
  id          uuid        primary key default gen_random_uuid(),
  note_id     uuid        not null unique references public.notes(id) on delete cascade,
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  slug        text        not null unique,
  link_access text        not null default 'private' check (link_access in ('private', 'view')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists note_shares_owner_idx on public.note_shares (owner_id);

drop trigger if exists trigger_update_note_shares_updated_at on public.note_shares;
create trigger trigger_update_note_shares_updated_at
  before update on public.note_shares
  for each row execute function update_updated_at();

alter table public.note_shares enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_shares' and policyname='note_shares_owner_all') then
    execute $p$
      create policy note_shares_owner_all on public.note_shares
        for all to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());
    $p$;
  end if;
end
$$;

grant select, insert, update, delete on public.note_shares to authenticated;
grant select, insert, update, delete on public.note_shares to service_role;

-- ── note_share_recipients: sharing with named people ─────────────────────────

create table if not exists public.note_share_recipients (
  id           uuid        primary key default gen_random_uuid(),
  note_id      uuid        not null references public.notes(id) on delete cascade,
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  permission   text        not null default 'view' check (permission in ('view', 'edit')),
  created_at   timestamptz not null default now(),
  constraint note_share_recipients_unique unique (note_id, recipient_id),
  constraint note_share_recipients_not_self check (recipient_id <> owner_id)
);

create index if not exists note_share_recipients_recipient_idx on public.note_share_recipients (recipient_id);
create index if not exists note_share_recipients_note_idx      on public.note_share_recipients (note_id);

alter table public.note_share_recipients enable row level security;

do $$
begin
  -- The owner manages the whole row.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_share_recipients' and policyname='note_share_recipients_owner_all') then
    execute $p$
      create policy note_share_recipients_owner_all on public.note_share_recipients
        for all to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());
    $p$;
  end if;
  -- A recipient may read (only) the rows naming them, so the app can show
  -- "shared with me" without handing them anyone else's sharing list.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_share_recipients' and policyname='note_share_recipients_recipient_select') then
    execute $p$
      create policy note_share_recipients_recipient_select on public.note_share_recipients
        for select to authenticated
        using (recipient_id = auth.uid());
    $p$;
  end if;
end
$$;

grant select, insert, update, delete on public.note_share_recipients to authenticated;
grant select, insert, update, delete on public.note_share_recipients to service_role;

-- ── notes RLS: let recipients reach what was shared with them ────────────────
-- Policies are OR-ed, so these are purely additive to the existing
-- owner-scoped policies. Note the API still filters explicitly by user_id on
-- every owner-facing query — these policies widen only the shared paths,
-- which query by note id instead.

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notes' and policyname='notes_select_shared_with_me') then
    execute $p$
      create policy notes_select_shared_with_me on public.notes
        for select to authenticated
        using (exists (
          select 1 from public.note_share_recipients r
          where r.note_id = notes.id and r.recipient_id = auth.uid()
        ));
    $p$;
  end if;
  -- Edit permission is checked in the policy itself, not just in the API, so
  -- a 'view' recipient cannot write even if a route ever forgot to check.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notes' and policyname='notes_update_shared_with_me') then
    execute $p$
      create policy notes_update_shared_with_me on public.notes
        for update to authenticated
        using (exists (
          select 1 from public.note_share_recipients r
          where r.note_id = notes.id and r.recipient_id = auth.uid() and r.permission = 'edit'
        ))
        with check (exists (
          select 1 from public.note_share_recipients r
          where r.note_id = notes.id and r.recipient_id = auth.uid() and r.permission = 'edit'
        ));
    $p$;
  end if;
end
$$;

-- ── note_attachments ─────────────────────────────────────────────────────────
-- Recording every upload as a row is what makes the Attachments view possible
-- without scraping HTML out of every note, and what makes deleting a note
-- able to clean up its storage objects instead of orphaning them.

create table if not exists public.note_attachments (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  note_id    uuid        references public.notes(id) on delete cascade,
  storage_path text      not null,
  url        text        not null,
  name       text        not null,
  mime_type  text        not null,
  size_bytes bigint      not null default 0,
  kind       text        not null check (kind in ('image', 'file')),
  created_at timestamptz not null default now()
);

create index if not exists note_attachments_user_idx on public.note_attachments (user_id, created_at desc);
create index if not exists note_attachments_note_idx on public.note_attachments (note_id);

alter table public.note_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_attachments' and policyname='note_attachments_select') then
    execute $p$ create policy note_attachments_select on public.note_attachments for select to authenticated using (user_id = auth.uid()); $p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_attachments' and policyname='note_attachments_insert') then
    execute $p$ create policy note_attachments_insert on public.note_attachments for insert to authenticated with check (user_id = auth.uid()); $p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_attachments' and policyname='note_attachments_update') then
    execute $p$ create policy note_attachments_update on public.note_attachments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid()); $p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='note_attachments' and policyname='note_attachments_delete') then
    execute $p$ create policy note_attachments_delete on public.note_attachments for delete to authenticated using (user_id = auth.uid()); $p$;
  end if;
end
$$;

grant select, insert, update, delete on public.note_attachments to authenticated;
grant select, insert, update, delete on public.note_attachments to service_role;

-- ── Storage: non-image attachments ───────────────────────────────────────────
-- The existing note-attachments bucket already carries the right per-user
-- write policies (uid-prefixed paths); this only widens what may be stored in
-- it, since §12 asks for PDFs and documents alongside images.

update storage.buckets
set file_size_limit = 20971520
where id = 'note-attachments';
