-- Add manual text name columns to allow unregistered players to be added by admins

ALTER TABLE public.rr_group_members
  ADD COLUMN IF NOT EXISTS manual_name text;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS player1_manual_name text,
  ADD COLUMN IF NOT EXISTS player2_manual_name text;
