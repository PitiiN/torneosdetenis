-- Migration: Add is_bye column to matches and optimize bye checking performance
-- Date: 2026-07-15

-- 1. Add column is_bye to matches table if not exists
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_bye BOOLEAN DEFAULT FALSE;

-- 2. Backfill existing matches: Set is_bye = TRUE for all matches currently identified as BYE
UPDATE public.matches m 
SET is_bye = TRUE 
WHERE public.is_match_bye(m) = TRUE;

-- 3. Redefine is_match_bye to be an O(1) function returning the persisted column value
CREATE OR REPLACE FUNCTION public.is_match_bye(p_match public.matches)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN COALESCE(p_match.is_bye, FALSE);
END;
$function$;
