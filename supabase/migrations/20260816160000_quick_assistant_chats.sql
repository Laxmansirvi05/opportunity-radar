-- Migration: quick_assistant_chats
--
-- The robot's double-tap Quick Assistant is the same assistant as /assistant —
-- same route, same gateway, same tables. It only needs to be *distinguishable*,
-- so its conversations can be listed separately (and capped) without leaking
-- into the main History list.
--
-- One column rather than a second conversations table, for the same reason
-- notes.source exists: a quick chat is an ordinary conversation that happens to
-- have been started from the robot. Splitting the table would mean every read,
-- delete and RLS policy existing twice.

alter table public.chat_conversations
  add column if not exists source text not null default 'assistant';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_conversations_source_valid') then
    alter table public.chat_conversations
      add constraint chat_conversations_source_valid check (source in ('assistant', 'quick'));
  end if;
end
$$;

-- Both history lists read by (user, source) newest-first.
create index if not exists chat_conversations_user_source_idx
  on public.chat_conversations (user_id, source, updated_at desc);
