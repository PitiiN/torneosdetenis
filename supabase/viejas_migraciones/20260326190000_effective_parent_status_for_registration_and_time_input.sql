begin;

create or replace function public.create_master_tournament(
  p_organization_id uuid,
  p_name text,
  p_status text,
  p_start_date date,
  p_end_date date,
  p_registration_close_at date,
  p_registration_close_time text,
  p_address text,
  p_comuna text,
  p_surface text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_normalized_status text;
  v_registration_close_time_raw text;
  v_registration_close_time time;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if p_organization_id is null then
    raise exception 'organization_id is required';
  end if;

  if not public.is_org_admin(p_organization_id) then
    raise exception 'forbidden create tournament';
  end if;

  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'name is required';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'start_date and end_date are required';
  end if;

  if p_end_date < p_start_date then
    raise exception 'end_date cannot be before start_date';
  end if;

  if p_registration_close_at is null then
    raise exception 'registration_close_at is required';
  end if;

  if p_registration_close_at > p_start_date then
    raise exception 'registration_close_at must be on or before start_date';
  end if;

  v_registration_close_time_raw := trim(coalesce(p_registration_close_time, ''));
  if v_registration_close_time_raw = '' then
    raise exception 'registration_close_time is required';
  end if;

  if v_registration_close_time_raw ~ '^[0-9]{4}$' then
    v_registration_close_time_raw :=
      substr(v_registration_close_time_raw, 1, 2) || ':' || substr(v_registration_close_time_raw, 3, 2);
  elsif v_registration_close_time_raw ~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' then
    null;
  else
    raise exception 'registration_close_time must use HHMM or HH:MM format';
  end if;

  v_registration_close_time := v_registration_close_time_raw::time;

  v_normalized_status := coalesce(nullif(trim(p_status), ''), 'open');
  if v_normalized_status not in ('draft', 'open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized', 'cancelled') then
    raise exception 'invalid tournament status';
  end if;

  insert into public.tournaments (
    organization_id,
    parent_tournament_id,
    is_tournament_master,
    name,
    status,
    start_date,
    end_date,
    registration_close_at,
    registration_close_time,
    address,
    comuna,
    surface,
    level,
    modality,
    format,
    set_type,
    max_players,
    registration_fee,
    description
  )
  values (
    p_organization_id,
    null,
    true,
    trim(p_name),
    v_normalized_status,
    p_start_date,
    p_end_date,
    p_registration_close_at,
    v_registration_close_time,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_comuna, '')), ''),
    nullif(trim(coalesce(p_surface, '')), ''),
    'Escalafón',
    'singles',
    'Eliminación Directa',
    'Al mejor de 3 Sets',
    2,
    0,
    'Torneo completo principal'
  )
  returning id into v_tournament_id;

  return v_tournament_id;
end;
$$;

create or replace function public.is_tournament_registration_open_for_requests(
  tournament_id_input uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments child
    left join public.tournaments parent
      on parent.id = child.parent_tournament_id
    where child.id = tournament_id_input
      and not coalesce(child.is_tournament_master, false)
      and (
        (child.parent_tournament_id is null and child.status in ('open', 'ongoing', 'in_progress'))
        or (child.parent_tournament_id is not null and coalesce(parent.status, 'draft') in ('open', 'ongoing', 'in_progress'))
      )
      and public.is_registration_deadline_open(child.id)
  );
$$;

revoke all on function public.is_tournament_registration_open_for_requests(uuid) from public;
grant execute on function public.is_tournament_registration_open_for_requests(uuid) to authenticated;

create or replace function public.registration_requests_server_enforcer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tournament_record record;
  manager_access boolean;
  confirmed_registration_id uuid;
  effective_deadline timestamp without time zone;
  effective_status text;
begin
  if new.tournament_id is null then
    raise exception 'tournament_id is required';
  end if;

  select
    t.id,
    t.organization_id,
    t.status,
    t.parent_tournament_id,
    parent_tournament.status as parent_status,
    coalesce(t.is_tournament_master, false) as is_tournament_master,
    coalesce(t.registration_fee, 0) as registration_fee
  into tournament_record
  from public.tournaments t
  left join public.tournaments parent_tournament
    on parent_tournament.id = t.parent_tournament_id
  where t.id = new.tournament_id;

  if tournament_record.id is null then
    raise exception 'tournament not found';
  end if;

  if tournament_record.is_tournament_master then
    raise exception 'cannot request registration on master tournament';
  end if;

  if tournament_record.parent_tournament_id is not null then
    effective_status := coalesce(tournament_record.parent_status, 'draft');
  else
    effective_status := tournament_record.status;
  end if;

  effective_deadline := public.get_effective_registration_deadline(new.tournament_id);
  manager_access := public.is_tournament_admin(new.tournament_id);

  if tg_op = 'INSERT' then
    if new.player_id is null then
      new.player_id := auth.uid();
    end if;

    if new.player_id is null then
      raise exception 'player_id is required';
    end if;

    if not manager_access and auth.uid() is distinct from new.player_id then
      raise exception 'cannot submit another player request';
    end if;

    if not manager_access and effective_status not in ('open', 'ongoing', 'in_progress') then
      raise exception 'registration request window is closed';
    end if;

    if not manager_access
       and effective_deadline is not null
       and now()::timestamp > effective_deadline then
      raise exception 'registration request deadline reached';
    end if;

    if exists (
      select 1
      from public.registrations r
      where r.tournament_id = new.tournament_id
        and r.player_id = new.player_id
        and coalesce(r.status, 'confirmed') <> 'cancelled'
    ) then
      raise exception 'player already registered';
    end if;

    new.organization_id := tournament_record.organization_id;
    new.status := 'pending';
    new.rejection_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.approved_registration_id := null;

    if not public.is_valid_payment_proof_path(
      new.proof_path,
      new.organization_id,
      new.tournament_id,
      new.player_id
    ) then
      raise exception 'invalid proof_path';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not manager_access then
      raise exception 'forbidden registration request update';
    end if;

    if new.tournament_id is distinct from old.tournament_id
      or new.organization_id is distinct from old.organization_id
      or new.player_id is distinct from old.player_id
      or new.proof_path is distinct from old.proof_path then
      raise exception 'immutable request fields';
    end if;

    if new.status not in ('pending', 'approved', 'rejected') then
      raise exception 'invalid request status';
    end if;

    if new.status = 'pending' then
      new.rejection_reason := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.approved_registration_id := null;
      return new;
    end if;

    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    new.reviewed_at := coalesce(new.reviewed_at, now());

    if new.status = 'rejected' then
      if length(trim(coalesce(new.rejection_reason, ''))) < 3 then
        raise exception 'rejection_reason is required';
      end if;
      new.approved_registration_id := null;
      return new;
    end if;

    new.rejection_reason := null;

    insert into public.registrations (
      tournament_id,
      player_id,
      status,
      fee_amount,
      is_paid
    )
    values (
      new.tournament_id,
      new.player_id,
      'confirmed',
      tournament_record.registration_fee,
      true
    )
    on conflict (tournament_id, player_id)
    do update set
      status = 'confirmed',
      fee_amount = excluded.fee_amount,
      is_paid = true
    returning id into confirmed_registration_id;

    new.approved_registration_id := confirmed_registration_id;
    return new;
  end if;

  return new;
end;
$$;

drop policy if exists tournament_registration_requests_insert_policy on public.tournament_registration_requests;
create policy tournament_registration_requests_insert_policy
on public.tournament_registration_requests
for insert
to authenticated
with check (
  auth.uid() is not null
  and coalesce(player_id, auth.uid()) = auth.uid()
  and exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and public.is_tournament_registration_open_for_requests(t.id)
  )
);

do $$
begin
  execute 'drop policy if exists organizations_assets_insert_payment_proofs on storage.objects';

  execute $sql$
    create policy organizations_assets_insert_payment_proofs
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'payment-proofs'
      and (storage.foldername(name))[4] = auth.uid()::text
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 7340032
      and exists (
        select 1
        from public.tournaments t
        where t.id::text = (storage.foldername(name))[3]
          and t.organization_id::text = (storage.foldername(name))[2]
          and public.is_tournament_registration_open_for_requests(t.id)
      )
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping payment proof insert policy update due to insufficient privilege.';
end;
$$;

revoke all on function public.registration_requests_server_enforcer() from public;

commit;
