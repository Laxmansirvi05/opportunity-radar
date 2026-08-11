-- ============================================================================
-- Certifications: real certificate/badge preview image
--
-- Separate from provider_logo (the provider's brand logo, shown on every one
-- of their listings) — this is the specific badge/certificate image for THIS
-- certification, only populated where a source genuinely provides one (e.g.
-- Microsoft Learn's real per-certification badge SVGs). Left null rather
-- than reusing provider_logo or fabricating a generic badge when a source
-- doesn't have one.
-- ============================================================================

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS certificate_image TEXT;
