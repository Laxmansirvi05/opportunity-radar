-- Migration: hub_messages_grants
-- Adds missing grants to the hub_messages table.

grant select, insert, delete, update on table public.hub_messages to authenticated;
grant select, insert, delete, update on table public.hub_messages to service_role;
