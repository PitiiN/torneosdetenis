-- Add round_number to tournament_matches to properly sort and group brackets
ALTER TABLE public.tournament_matches ADD COLUMN round_number integer DEFAULT 0 NOT NULL;
