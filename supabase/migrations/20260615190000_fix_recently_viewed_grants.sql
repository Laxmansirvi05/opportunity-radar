-- Fix permission denied error for recently_viewed table
GRANT ALL ON public.recently_viewed TO authenticated;
GRANT SELECT ON public.recently_viewed TO anon;
