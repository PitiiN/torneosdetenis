create or replace function public.delete_tournament_cascade(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if p_tournament_id is null then
    raise exception 'tournament_id is required';
  end if;

  if not public.is_tournament_admin(p_tournament_id) then
    raise exception 'forbidden delete tournament';
  end if;

  with recursive tournament_tree as (
    select id
    from public.tournaments
    where id = p_tournament_id

    union all

    select child.id
    from public.tournaments child
    inner join tournament_tree parent_tournament
      on child.parent_tournament_id = parent_tournament.id
  )
  select array_agg(id)
  into v_tournament_ids
  from tournament_tree;

  if v_tournament_ids is null or array_length(v_tournament_ids, 1) is null then
    raise exception 'tournament not found';
  end if;

  delete from public.payment_proofs
  where registration_id in (
    select id
    from public.registrations
    where tournament_id = any(v_tournament_ids)
  );

  delete from public.tournament_registration_requests
  where tournament_id = any(v_tournament_ids);

  delete from public.tournaments
  where id = any(v_tournament_ids);
end;
$$;

grant execute on function public.delete_tournament_cascade(uuid) to authenticated;
grant execute on function public.delete_tournament_cascade(uuid) to service_role;
