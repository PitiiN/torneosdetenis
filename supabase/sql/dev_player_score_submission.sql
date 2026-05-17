-- 1. Add players_can_submit_scores column to tournaments
alter table public.tournaments
  add column if not exists players_can_submit_scores boolean not null default false;

-- 2. Drop existing update policy if it exists to avoid duplicates
drop policy if exists "matches_update_player_autocarga_policy" on "public"."matches";

-- 3. Create the player autocarga update policy
create policy "matches_update_player_autocarga_policy" on "public"."matches"
  for update
  to authenticated
  using (
    (
      exists (
        select 1 from public.tournaments t
        where t.id = matches.tournament_id
          and t.players_can_submit_scores = true
      ) and exists (
        select 1 from public.registrations r
        where r.tournament_id = matches.tournament_id
          and r.player_id = auth.uid()
      )
    )
  )
  with check (
    (
      exists (
        select 1 from public.tournaments t
        where t.id = matches.tournament_id
          and t.players_can_submit_scores = true
      ) and exists (
        select 1 from public.registrations r
        where r.tournament_id = matches.tournament_id
          and r.player_id = auth.uid()
      )
    )
  );
