begin;

alter table if exists public.tournaments
  add column if not exists registration_close_time time without time zone;

update public.tournaments
set registration_close_time = coalesce(registration_close_time, time '23:59:59')
where parent_tournament_id is null
  and registration_close_at is not null
  and registration_close_time is null;

update public.tournaments
set registration_close_at = null,
    registration_close_time = null
where parent_tournament_id is not null
  and (registration_close_at is not null or registration_close_time is not null);

do $$
begin
  if to_regclass('public.tournaments') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_registration_close_time_requires_date_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_registration_close_time_requires_date_chk
      check (registration_close_time is null or registration_close_at is not null)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_child_registration_deadline_null_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_child_registration_deadline_null_chk
      check (
        parent_tournament_id is null
        or (registration_close_at is null and registration_close_time is null)
      )
      not valid;
  end if;
end
$$;

create or replace function public.get_effective_registration_deadline(
  tournament_id_input uuid
)
returns timestamp without time zone
language sql
stable
security definer
set search_path = public
as $$
  with selected as (
    select
      t.parent_tournament_id,
      t.registration_close_at as own_close_date,
      t.registration_close_time as own_close_time,
      parent_tournament.registration_close_at as parent_close_date,
      parent_tournament.registration_close_time as parent_close_time
    from public.tournaments t
    left join public.tournaments parent_tournament
      on parent_tournament.id = t.parent_tournament_id
    where t.id = tournament_id_input
    limit 1
  )
  select
    case
      when parent_tournament_id is not null and parent_close_date is not null then
        parent_close_date::timestamp + coalesce(parent_close_time, time '23:59:59')
      when own_close_date is not null then
        own_close_date::timestamp + coalesce(own_close_time, time '23:59:59')
      else null
    end
  from selected;
$$;

create or replace function public.is_registration_deadline_open(
  tournament_id_input uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when deadline_value is null then true
      else now()::timestamp <= deadline_value
    end
  from (
    select public.get_effective_registration_deadline(tournament_id_input) as deadline_value
  ) deadline_row;
$$;

revoke all on function public.get_effective_registration_deadline(uuid) from public;
revoke all on function public.is_registration_deadline_open(uuid) from public;
grant execute on function public.get_effective_registration_deadline(uuid) to authenticated;
grant execute on function public.is_registration_deadline_open(uuid) to authenticated;

drop function if exists public.create_master_tournament(uuid, text, text, date, date, text, text, text);
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

  if length(trim(coalesce(p_registration_close_time, ''))) = 0 then
    raise exception 'registration_close_time is required';
  end if;

  if trim(p_registration_close_time) !~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' then
    raise exception 'registration_close_time must use HH:MM format';
  end if;

  v_registration_close_time := trim(p_registration_close_time)::time;

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

revoke all on function public.create_master_tournament(uuid, text, text, date, date, date, text, text, text, text) from public;
grant execute on function public.create_master_tournament(uuid, text, text, date, date, date, text, text, text, text) to authenticated;

drop function if exists public.create_championship_tournament(uuid, text, text, text, text, text, integer, numeric, date, text);
create or replace function public.create_championship_tournament(
  p_master_tournament_id uuid,
  p_name text,
  p_modality text,
  p_level text,
  p_format text,
  p_set_type text,
  p_max_players integer,
  p_registration_fee numeric,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_championship_id uuid;
  v_organization_id uuid;
  v_master_name text;
  v_master_status text;
  v_master_start_date date;
  v_master_end_date date;
  v_master_address text;
  v_master_comuna text;
  v_master_surface text;
  v_is_master boolean;
  v_modality text;
  v_level text;
  v_format text;
  v_set_type text;
  v_description text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if p_master_tournament_id is null then
    raise exception 'master_tournament_id is required';
  end if;

  select
    t.organization_id,
    t.name,
    t.status,
    t.start_date,
    t.end_date,
    t.address,
    t.comuna,
    t.surface,
    coalesce(t.is_tournament_master, false)
  into
    v_organization_id,
    v_master_name,
    v_master_status,
    v_master_start_date,
    v_master_end_date,
    v_master_address,
    v_master_comuna,
    v_master_surface,
    v_is_master
  from public.tournaments t
  where t.id = p_master_tournament_id;

  if v_organization_id is null then
    raise exception 'master tournament not found';
  end if;

  if not v_is_master then
    raise exception 'parent tournament must be a master tournament';
  end if;

  if not public.is_org_admin(v_organization_id) then
    raise exception 'forbidden create championship';
  end if;

  v_modality := lower(trim(coalesce(p_modality, '')));
  if v_modality not in ('singles', 'dobles') then
    raise exception 'invalid modality';
  end if;

  v_level := trim(coalesce(p_level, ''));
  if length(v_level) < 2 then
    raise exception 'level is required';
  end if;

  if p_max_players is null or p_max_players < 2 or p_max_players > 256 then
    raise exception 'invalid max_players';
  end if;

  if coalesce(p_registration_fee, 0) < 0 then
    raise exception 'registration_fee must be non-negative';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := trim(v_level || ' ' || case when v_modality = 'dobles' then 'Dobles' else 'Singles' end);
  end if;
  if length(v_name) < 3 then
    raise exception 'name is required';
  end if;

  v_format := lower(trim(coalesce(p_format, '')));
  if v_format like '%round robin%' then
    v_format := 'Round Robin';
  elsif v_format like '%repech%' then
    v_format := 'Eliminación Directa con Repechaje';
  else
    v_format := 'Eliminación Directa';
  end if;

  v_set_type := lower(trim(coalesce(p_set_type, '')));
  if v_set_type = '' then
    v_set_type := 'al mejor de 3 sets';
  end if;

  if v_set_type like '%corto%' then
    v_set_type := 'Set Corto';
  elsif v_set_type like '%5%' then
    v_set_type := 'Al mejor de 5 Sets';
  else
    v_set_type := 'Al mejor de 3 Sets';
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');

  insert into public.tournaments (
    organization_id,
    parent_tournament_id,
    is_tournament_master,
    name,
    status,
    start_date,
    end_date,
    address,
    comuna,
    surface,
    modality,
    level,
    format,
    set_type,
    max_players,
    registration_fee,
    registration_close_at,
    registration_close_time,
    description
  )
  values (
    v_organization_id,
    p_master_tournament_id,
    false,
    v_name,
    coalesce(v_master_status, 'open'),
    v_master_start_date,
    v_master_end_date,
    v_master_address,
    v_master_comuna,
    v_master_surface,
    v_modality,
    v_level,
    v_format,
    v_set_type,
    p_max_players,
    coalesce(p_registration_fee, 0),
    null,
    null,
    v_description
  )
  returning id into v_championship_id;

  return v_championship_id;
end;
$$;

revoke all on function public.create_championship_tournament(uuid, text, text, text, text, text, integer, numeric, text) from public;
grant execute on function public.create_championship_tournament(uuid, text, text, text, text, text, integer, numeric, text) to authenticated;

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
begin
  if new.tournament_id is null then
    raise exception 'tournament_id is required';
  end if;

  select
    t.id,
    t.organization_id,
    t.status,
    coalesce(t.is_tournament_master, false) as is_tournament_master,
    coalesce(t.registration_fee, 0) as registration_fee
  into tournament_record
  from public.tournaments t
  where t.id = new.tournament_id;

  if tournament_record.id is null then
    raise exception 'tournament not found';
  end if;

  if tournament_record.is_tournament_master then
    raise exception 'cannot request registration on master tournament';
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

    if not manager_access and tournament_record.status not in ('open', 'ongoing', 'in_progress') then
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
      and not coalesce(t.is_tournament_master, false)
      and t.status in ('open', 'ongoing', 'in_progress')
      and public.is_registration_deadline_open(t.id)
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
          and not coalesce(t.is_tournament_master, false)
          and t.status in ('open', 'ongoing', 'in_progress')
          and public.is_registration_deadline_open(t.id)
      )
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping payment proof insert policy update due to insufficient privilege.';
end;
$$;

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

revoke all on function public.registration_requests_server_enforcer() from public;

commit;
