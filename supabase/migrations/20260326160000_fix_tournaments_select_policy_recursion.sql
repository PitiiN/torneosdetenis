begin;

create or replace function public.is_visible_parent_tournament(
  parent_tournament_id_input uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = parent_tournament_id_input
      and t.status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
  );
$$;

revoke all on function public.is_visible_parent_tournament(uuid) from public;
grant execute on function public.is_visible_parent_tournament(uuid) to authenticated;

drop policy if exists tournaments_select_policy on public.tournaments;
create policy tournaments_select_policy
on public.tournaments
for select
to authenticated
using (
  public.is_org_admin(organization_id)
  or (
    parent_tournament_id is null
    and status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
  )
  or (
    parent_tournament_id is not null
    and public.is_visible_parent_tournament(parent_tournament_id)
  )
);

commit;
