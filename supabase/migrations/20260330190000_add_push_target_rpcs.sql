begin;

create or replace function public.get_tournament_player_push_targets(
  p_tournament_id uuid,
  p_player_ids uuid[] default null
)
returns table(
  user_id uuid,
  expo_push_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_access boolean := false;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select
    public.is_tournament_admin(p_tournament_id)
    or exists (
      select 1
      from public.registrations r
      where r.tournament_id = p_tournament_id
        and r.player_id = auth.uid()
    )
    or exists (
      select 1
      from public.tournament_registration_requests trr
      where trr.tournament_id = p_tournament_id
        and trr.player_id = auth.uid()
    )
  into v_has_access;

  if not coalesce(v_has_access, false) then
    raise exception 'forbidden';
  end if;

  return query
  select
    p.id as user_id,
    p.expo_push_token
  from public.profiles p
  join public.registrations r
    on r.player_id = p.id
   and r.tournament_id = p_tournament_id
  where coalesce(p.notifications_enabled, false) = true
    and (
      p_player_ids is null
      or array_length(p_player_ids, 1) is null
      or p.id = any(p_player_ids)
    );
end;
$$;

create or replace function public.get_tournament_admin_push_targets(
  p_tournament_id uuid
)
returns table(
  user_id uuid,
  expo_push_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_has_access boolean := false;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select t.organization_id
    into v_org_id
  from public.tournaments t
  where t.id = p_tournament_id;

  if v_org_id is null then
    return;
  end if;

  select
    public.is_tournament_admin(p_tournament_id)
    or exists (
      select 1
      from public.registrations r
      where r.tournament_id = p_tournament_id
        and r.player_id = auth.uid()
    )
    or exists (
      select 1
      from public.tournament_registration_requests trr
      where trr.tournament_id = p_tournament_id
        and trr.player_id = auth.uid()
    )
  into v_has_access;

  if not coalesce(v_has_access, false) then
    raise exception 'forbidden';
  end if;

  return query
  select
    p.id as user_id,
    p.expo_push_token
  from public.profiles p
  where p.org_id = v_org_id
    and p.role in ('admin', 'organizer')
    and coalesce(p.notifications_enabled, false) = true;
end;
$$;

revoke all on function public.get_tournament_player_push_targets(uuid, uuid[]) from public;
revoke all on function public.get_tournament_admin_push_targets(uuid) from public;

grant execute on function public.get_tournament_player_push_targets(uuid, uuid[]) to authenticated;
grant execute on function public.get_tournament_admin_push_targets(uuid) to authenticated;
grant execute on function public.get_tournament_player_push_targets(uuid, uuid[]) to service_role;
grant execute on function public.get_tournament_admin_push_targets(uuid) to service_role;

commit;
