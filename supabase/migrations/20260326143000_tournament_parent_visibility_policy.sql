begin;

drop policy if exists tournaments_select_policy on public.tournaments;
create policy tournaments_select_policy
on public.tournaments
for select
to authenticated
using (
  public.is_tournament_admin(id)
  or (
    parent_tournament_id is null
    and status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
  )
  or (
    parent_tournament_id is not null
    and exists (
      select 1
      from public.tournaments parent_tournament
      where parent_tournament.id = tournaments.parent_tournament_id
        and parent_tournament.status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
    )
  )
);

commit;
