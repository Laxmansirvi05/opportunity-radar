-- DeepInterview's own session store.
--
-- The voice agent (apps/agent, Python) persists through its SupabaseRepository,
-- which reads and writes exactly one table: public.sessions. Without it every
-- POST /api/prep fails — verified against the running agent, which logged
-- `POST /rest/v1/sessions "HTTP/2 404 Not Found"` and returned a 500. That is
-- why the mock interview has never started a real session.
--
-- This is deliberately NOT a copy of DeepInterview's supabase/migrations/*.sql.
-- Running those verbatim against this database would be destructive:
--
--   * 0001 does `create or replace function public.handle_new_user()`, and we
--     already have our own function of that name wired to auth.users. Replacing
--     it would break profile creation on signup for the entire app.
--   * 0001 also adds policies and a second on_auth_user_created trigger to our
--     existing public.profiles (8 rows), which it does not own.
--   * 0006 drops columns (plan, interviews_used, credits, ...) from profiles.
--
-- So only the table the agent actually needs is created here, with the columns
-- its repository touches: 0001's base row plus 0003's progress/prep_warnings
-- and 0004's coach_transcript, flattened into one statement.

create table if not exists public.sessions (
  id text primary key,

  -- Nullable, and auth.users rather than profiles: the agent stamps whatever
  -- user_id the prep request carried, and its offline/dev path sends none.
  -- auth.users matches the newer convention used by ai_search_jobs,
  -- chat_conversations and interview_sessions.
  user_id uuid references auth.users(id) on delete cascade,

  status text not null default 'prep',

  company text,
  -- Named cv_url by the agent's contract, but it holds the CV's raw *text*:
  -- OPPORTUNITY_RADAR_INTEGRATION.md §2 defines a non-URL value here as a
  -- passthrough, which is how we send the serialised resume.
  cv_url text,
  jd_text text,
  language_mode jsonb not null default '{"primary":"en","mixed":false}'::jsonb,

  -- Pipeline output, all written as whole documents by the repository.
  context jsonb,
  scorecard jsonb,
  transcript jsonb,
  coach_transcript jsonb,

  -- Live prep progress (ordered step keys) and input-quality warnings.
  progress jsonb not null default '[]'::jsonb,
  prep_warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

-- Supports the stuck-session sweep: find rows left mid-interview, newest first.
create index if not exists sessions_status_updated_at_idx
  on public.sessions (status, updated_at desc);

alter table public.sessions enable row level security;

-- The agent connects with the service-role key and bypasses RLS entirely; this
-- policy exists so that if anything ever reaches this table with a user's own
-- JWT, it sees only its own rows rather than everybody's.
drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Its own trigger function rather than a shared touch_updated_at(): a
-- create-or-replace on a common name is exactly how DeepInterview's migration
-- would have clobbered ours, and this table should not be able to do that to
-- anything else.
create or replace function public.deepinterview_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch
  before update on public.sessions
  for each row
  execute function public.deepinterview_touch_updated_at();

-- Grants, explicitly. A table created by a migration does not pick up the
-- default privileges the rest of this schema has, so without these the agent's
-- insert fails with `permission denied for table sessions` (42501) — the second
-- failure this table hit, after the missing-table 404.
grant select, insert, update, delete on public.sessions to service_role;

-- Read-only for a signed-in user, still filtered by "own sessions" above.
-- Writes stay with the agent, and the browser reads its report through the
-- agent API rather than this table, so nothing more is granted.
grant select on public.sessions to authenticated;
