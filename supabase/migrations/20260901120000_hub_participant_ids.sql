-- Migration: hub_participant_ids
--
-- Bounds the two privileged profile reads behind the Hub to people who are
-- actually in the room.
--
-- Both /api/hub/senders and the getPublicProfile server action take user ids
-- straight from the caller and resolve them with the service-role key, which
-- bypasses the `auth.uid() = id` SELECT policy on profiles. Any authenticated
-- user could therefore hand either one an arbitrary id — or up to a hundred of
-- them per request — and read back name, avatar, LinkedIn, email, bio,
-- university, degree, graduation year, skills and achievements for someone who
-- had never posted in the Hub and had no relationship to them at all.
--
-- The privileged read itself is necessary: the Hub is a shared room, so showing
-- who sent a message inherently means reading another user's profile, and the
-- RLS policy on profiles cannot express that. What was missing is the bound.
-- This function supplies it — of the ids offered, the subset that has actually
-- posted in the Hub, and therefore whose presence is already visible to every
-- member.
--
-- Why a function rather than a `.in('sender_id', ids)` query deduplicated in
-- application code: PostgREST has no DISTINCT, so the query form returns one
-- row per message and has to be capped with a limit. Any cap is a correctness
-- bug — a single chatty member can push a quieter one past it, and that member
-- then silently loses their name and avatar everywhere in the room. Postgres
-- does the DISTINCT here, so the result is bounded by the number of ids asked
-- about rather than the number of messages sent.
--
-- SECURITY INVOKER is deliberate: hub_messages_select already grants every
-- authenticated user read access to all Hub messages, so the caller learns
-- nothing here they could not learn by reading the room. Callers pass their own
-- user-scoped client, which keeps that check honest, and use the service-role
-- client only for the narrowed id list.

create or replace function public.hub_participant_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select distinct m.sender_id
  from public.hub_messages m
  where m.sender_id = any(p_ids);
$$;

comment on function public.hub_participant_ids(uuid[]) is
  'Of the given user ids, those that have posted in the Hub. Bounds the privileged profile reads behind the Hub to members already visible in the room.';

grant execute on function public.hub_participant_ids(uuid[]) to authenticated;
