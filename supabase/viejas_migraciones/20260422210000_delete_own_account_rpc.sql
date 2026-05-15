-- Migration: Self-service account deletion RPC
-- Users can fully delete their own account via this RPC.
-- The champion tag is reassigned to the other finalist (no points change).

begin;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _tournament record;
  _final_match record;
  _loser_name text;
  _new_description text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- =========================================================================
  -- 1. Reassign champion tag for tournaments where this user won the final
  -- =========================================================================
  for _tournament in
    select t.id, t.description, t.modality
    from public.tournaments t
    where t.status in ('completed', 'finalized', 'finished')
      and t.description like '%[CHAMPION:%'
  loop
    -- Find the final match (highest round_number, excluding consolation/groups)
    select m.*
    into _final_match
    from public.matches m
    where m.tournament_id = _tournament.id
      and lower(coalesce(m.round, '')) not like '%grupo%'
      and lower(coalesce(m.round, '')) not like '%puesto%'
      and lower(coalesce(m.round, '')) not like '%consolaci%'
      and lower(coalesce(m.round, '')) not like '%repech%'
    order by coalesce(m.round_number, 0) desc
    limit 1;

    if _final_match is null then
      continue;
    end if;

    -- Check if our user was the winner of this final
    if _final_match.winner_id is distinct from _uid
       and _final_match.winner_2_id is distinct from _uid then
      continue;  -- user was not the champion here
    end if;

    -- Determine the loser (the other finalist) and get their name
    declare
      _loser_id uuid;
    begin
      if _final_match.winner_id = _uid then
        -- Winner is on side A or B; find the loser on the opposite side
        if _final_match.player_a_id = _uid then
          _loser_id := _final_match.player_b_id;
        else
          _loser_id := _final_match.player_a_id;
        end if;
      else
        -- For doubles where winner_2_id = _uid, same logic
        if _final_match.player_a2_id = _uid then
          _loser_id := _final_match.player_b2_id;
        else
          _loser_id := _final_match.player_a2_id;
        end if;
      end if;

      if _loser_id is not null then
        select coalesce(nullif(trim(p.name), ''), 'Jugador')
        into _loser_name
        from public.profiles p
        where p.id = _loser_id;
      end if;

      _loser_name := coalesce(_loser_name, 'Finalista');

      -- Replace/update the CHAMPION tag in the description
      -- Remove existing champion tag(s) and add the new one
      _new_description := regexp_replace(
        coalesce(_tournament.description, ''),
        '\[CHAMPION:[^\]]*\]',
        '',
        'g'
      );
      _new_description := trim(_new_description);

      if _new_description = '' then
        _new_description := '[CHAMPION:' || _loser_name || ']';
      else
        _new_description := _new_description || ' [CHAMPION:' || _loser_name || ']';
      end if;

      update public.tournaments
      set description = _new_description
      where id = _tournament.id;
    end;
  end loop;

  -- =========================================================================
  -- 2. Nullify match player references (keep match history but anonymize)
  -- =========================================================================
  update public.matches set player_a_id = null where player_a_id = _uid;
  update public.matches set player_b_id = null where player_b_id = _uid;
  update public.matches set player_a2_id = null where player_a2_id = _uid;
  update public.matches set player_b2_id = null where player_b2_id = _uid;
  update public.matches set winner_id = null where winner_id = _uid;
  update public.matches set winner_2_id = null where winner_2_id = _uid;

  -- =========================================================================
  -- 3. Delete registrations
  -- =========================================================================
  delete from public.registrations where player_id = _uid;

  -- =========================================================================
  -- 4. Delete tournament registration requests
  -- =========================================================================
  delete from public.tournament_registration_requests where player_id = _uid;

  -- =========================================================================
  -- 5. Delete notifications
  -- =========================================================================
  delete from public.notifications where user_id = _uid;

  -- =========================================================================
  -- 6. Delete profile
  -- =========================================================================
  delete from public.profiles where id = _uid;

  -- =========================================================================
  -- 7. Delete auth user (requires security definer)
  -- =========================================================================
  delete from auth.users where id = _uid;

end;
$$;

-- Restrict access: only authenticated users can call it, and the function
-- internally uses auth.uid() so it can only delete the caller's own account.
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

commit;
