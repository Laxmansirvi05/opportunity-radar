-- Migration: hub_messages
-- Creates the global community chat table for Opportunity Radar Hub.
-- Idempotent: uses IF NOT EXISTS everywhere.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists public.hub_messages (
  id          uuid        primary key default gen_random_uuid(),
  sender_id   uuid        not null references auth.users(id) on delete cascade,
  content     text        not null check (char_length(trim(content)) between 1 and 2000),
  reply_to_id uuid        references public.hub_messages(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary retrieval pattern: latest messages first.
create index if not exists hub_messages_created_at_idx
  on public.hub_messages (created_at desc, id desc);

-- Efficient reply target lookup.
create index if not exists hub_messages_reply_to_idx
  on public.hub_messages (reply_to_id)
  where reply_to_id is not null;

-- Sender index so we can filter by user without a seq scan.
create index if not exists hub_messages_sender_idx
  on public.hub_messages (sender_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.hub_messages enable row level security;

-- Any authenticated user may read all Hub messages.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hub_messages'
      and policyname = 'hub_messages_select'
  ) then
    execute $p$
      create policy hub_messages_select
        on public.hub_messages
        for select
        to authenticated
        using (true);
    $p$;
  end if;
end
$$;

-- A user may only INSERT a message where sender_id equals their own uid.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hub_messages'
      and policyname = 'hub_messages_insert'
  ) then
    execute $p$
      create policy hub_messages_insert
        on public.hub_messages
        for insert
        to authenticated
        with check (sender_id = auth.uid());
    $p$;
  end if;
end
$$;

-- A user may only DELETE their own messages.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hub_messages'
      and policyname = 'hub_messages_delete'
  ) then
    execute $p$
      create policy hub_messages_delete
        on public.hub_messages
        for delete
        to authenticated
        using (sender_id = auth.uid());
    $p$;
  end if;
end
$$;

-- ── Realtime ──────────────────────────────────────────────────────────────────

-- Only add the table to the publication if it is not already a member.
-- Blindly running ALTER PUBLICATION … ADD TABLE on a table that is already a
-- member causes an error in some Postgres versions.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname   = 'supabase_realtime'
      and tablename = 'hub_messages'
  ) then
    alter publication supabase_realtime add table public.hub_messages;
  end if;
end
$$;
