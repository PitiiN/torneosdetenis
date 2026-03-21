-- Create tournaments table
CREATE TABLE public.tournaments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  modality text NOT NULL CHECK (modality IN ('singles', 'dobles')),
  category text NOT NULL CHECK (category IN ('cat-a', 'cat-b', 'cat-c', 'open')),
  format text NOT NULL CHECK (format IN ('eliminacion', 'round-robin', 'consolacion')),
  set_type text NOT NULL CHECK (set_type IN ('best3', 'short4', 'tb10')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  start_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tournament players table
CREATE TABLE public.tournament_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_name text, -- e.g. 'A', 'B' for round robin
  seed integer, -- positional seed for elimination
  points integer DEFAULT 0, -- for round robin standings
  matches_played integer DEFAULT 0,
  matches_won integer DEFAULT 0,
  matches_lost integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tournament_id, profile_id)
);

-- Create tournament matches table
CREATE TABLE public.tournament_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id uuid REFERENCES public.tournament_players(id) ON DELETE SET NULL,
  player2_id uuid REFERENCES public.tournament_players(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES public.tournament_players(id) ON DELETE SET NULL,
  round_name text NOT NULL, -- e.g., 'Cuartos', 'Semi', 'Final', 'Grupo A - R1'
  match_order integer NOT NULL, -- visual ordering within the format
  score text, -- e.g., '6-4 6-2'
  schedule_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Tournaments Policies
CREATE POLICY "Tournaments are viewable by everyone."
  ON public.tournaments FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tournaments"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update tournaments"
  ON public.tournaments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tournaments"
  ON public.tournaments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Tournament Players Policies
CREATE POLICY "Tournament players are viewable by everyone."
  ON public.tournament_players FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tournament players"
  ON public.tournament_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update tournament players"
  ON public.tournament_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tournament players"
  ON public.tournament_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Tournament Matches Policies
CREATE POLICY "Tournament matches are viewable by everyone."
  ON public.tournament_matches FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tournament matches"
  ON public.tournament_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update tournament matches"
  ON public.tournament_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tournament matches"
  ON public.tournament_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
