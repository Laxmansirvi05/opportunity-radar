-- ==============================================================================
-- Migration: Resume Builder Columns
-- Description: Adds columns required by Reactive Resume's builder to the
--              existing resumes table: tags, is_public, is_locked.
-- ==============================================================================

ALTER TABLE public.resumes
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
