begin;

create or replace function public.create_championship_tournament(
  p_master_tournament_id uuid,
  p_name text,
  p_modality text,
  p_level text,
  p_format text,
  p_set_type text,
  p_max_players integer,
  p_registration_fee numeric,
  p_registration_close_at date,
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

  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'name is required';
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

  if p_registration_close_at is not null
     and v_master_start_date is not null
     and p_registration_close_at > v_master_start_date::date then
    raise exception 'registration_close_at must be on or before start_date';
  end if;

  v_format := lower(trim(coalesce(p_format, '')));
  if v_format like '%round robin%' then
    v_format := 'Round Robin';
  elsif v_format like '%repech%' then
    v_format := U&'Eliminaci\00F3n Directa con Repechaje';
  else
    v_format := U&'Eliminaci\00F3n Directa';
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
    description
  )
  values (
    v_organization_id,
    p_master_tournament_id,
    false,
    trim(coalesce(p_name, v_master_name || ' - ' || v_modality || ' ' || v_level)),
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
    p_registration_close_at,
    v_description
  )
  returning id into v_championship_id;

  return v_championship_id;
end;
$$;

revoke all on function public.create_championship_tournament(uuid, text, text, text, text, text, integer, numeric, date, text) from public;
grant execute on function public.create_championship_tournament(uuid, text, text, text, text, text, integer, numeric, date, text) to authenticated;

commit;
