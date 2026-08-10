-- ============================================================================
-- Fix resume_optimizations.original_resume_id: CASCADE -> SET NULL
--
-- The 20260810090000 migration stores source_resume as an inline JSONB
-- snapshot specifically "so a run is reproducible even if the source resume
-- row is later edited or deleted" -- but the original 20260626 migration's
-- foreign key was ON DELETE CASCADE, which contradicts that: deleting a saved
-- resume from /resume (deleteResume() does a real DELETE) silently destroyed
-- every optimisation run started from it, including a completed,
-- checklist-confirmed Resume B, even though the run's own data made that
-- unnecessary.
--
-- SET NULL is correct here: the run keeps functioning on its own snapshot,
-- it just loses the (rarely-used) back-reference to a resume that no longer
-- exists.
-- ============================================================================

ALTER TABLE public.resume_optimizations
  DROP CONSTRAINT IF EXISTS resume_optimizations_original_resume_id_fkey;

ALTER TABLE public.resume_optimizations
  ADD CONSTRAINT resume_optimizations_original_resume_id_fkey
  FOREIGN KEY (original_resume_id) REFERENCES public.resumes(id) ON DELETE SET NULL;
