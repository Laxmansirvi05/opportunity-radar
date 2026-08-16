-- Migration: notes
-- Creates the Notes table (manual notes + robot quick-capture notes — one
-- table, one API, distinguished only by `source`).
-- Idempotent: uses IF NOT EXISTS / DO blocks throughout.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists public.notes (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  title           text        not null default '',
  content         text        not null default '',
  source          text        not null default 'manual' check (source in ('manual', 'robot')),
  -- No separate "applications" table exists in this schema — application_tracker
  -- (status: Saved/Applied/Interview Scheduled/Selected/Rejected) already is the
  -- per-user, per-opportunity application record, so it's what application_id
  -- points at rather than a new parallel concept.
  opportunity_id  uuid        references public.opportunities(id) on delete set null,
  application_id  uuid        references public.application_tracker(id) on delete set null,
  tags            text[]      not null default '{}',
  is_pinned       boolean     not null default false,
  is_archived     boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint notes_not_empty check (char_length(trim(title)) > 0 or char_length(trim(content)) > 0)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary list query: a user's own notes, pinned first, most recently
-- updated first.
create index if not exists notes_user_pinned_updated_idx
  on public.notes (user_id, is_pinned desc, updated_at desc);

-- The common case (hide archived) is the default view — a partial index
-- keeps it cheap without scanning archived rows.
create index if not exists notes_user_active_idx
  on public.notes (user_id, updated_at desc)
  where is_archived = false;

-- Opportunity-context lookups (e.g. "does this opportunity already have
-- notes attached").
create index if not exists notes_opportunity_idx
  on public.notes (opportunity_id)
  where opportunity_id is not null;

-- ── updated_at trigger ───────────────────────────────────────────────────────

-- Reuses the update_updated_at() function already defined in
-- 20260607093005_init_schema.sql (used by opportunities/companies/
-- application_tracker) — no new trigger function needed.
drop trigger if exists trigger_update_notes_updated_at on public.notes;
create trigger trigger_update_notes_updated_at
  before update on public.notes
  for each row execute function update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_select'
  ) then
    execute $p$
      create policy notes_select
        on public.notes
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
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_insert'
  ) then
    execute $p$
      create policy notes_insert
        on public.notes
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
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_update'
  ) then
    execute $p$
      create policy notes_update
        on public.notes
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
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_delete'
  ) then
    execute $p$
      create policy notes_delete
        on public.notes
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
-- codebase that lesson (notifications/achievements shipped with policies
-- but no service_role grant, so the nightly cron 500'd and RLS was
-- unreachable by anyone). Both roles granted from the start here.
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.notes to service_role;
