begin;

create or replace function public.create_master_tournament(
  p_organization_id uuid,
  p_name text,
  p_status text,
  p_start_date date,
  p_end_date date,
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

-- Limpieza total para comenzar desde cero.
-- Se borra desde tournaments y los FK con ON DELETE CASCADE limpian matches,
-- registrations y tournament_registration_requests asociados.
delete from public.tournaments;

commit;

