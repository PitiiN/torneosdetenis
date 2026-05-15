


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app_private";


ALTER SCHEMA "app_private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."audit_log_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_id uuid;
  old_payload jsonb;
  new_payload jsonb;
begin
  actor_id := auth.uid();

  -- If the actor no longer has a profile row (for example, deleting their own
  -- account), keep the audit entry but drop the actor FK reference.
  if actor_id is not null
     and not exists (
       select 1
       from public.profiles
       where id = actor_id
     ) then
    actor_id := null;
  end if;

  old_payload := case when tg_op in ('UPDATE', 'DELETE') then public.audit_payload(tg_table_name, to_jsonb(old)) else null end;
  new_payload := case when tg_op in ('INSERT', 'UPDATE') then public.audit_payload(tg_table_name, to_jsonb(new)) else null end;

  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    if old_payload = new_payload then
      return new;
    end if;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    actor_id,
    tg_op,
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id::text else new.id::text end), null),
    old_payload,
    new_payload,
    jsonb_build_object(
      'source', 'db_trigger',
      'timestamp', now()
    )
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."audit_log_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_payload"("table_name_input" "text", "row_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case table_name_input
    when 'profiles' then jsonb_build_object(
      'id', row_data ->> 'id',
      'role', row_data ->> 'role',
      'org_id', row_data ->> 'org_id',
      'is_super_admin', row_data ->> 'is_super_admin'
    )
    when 'tournaments' then jsonb_build_object(
      'id', row_data ->> 'id',
      'organization_id', row_data ->> 'organization_id',
      'status', row_data ->> 'status',
      'level', row_data ->> 'level',
      'max_players', row_data ->> 'max_players',
      'start_date', row_data ->> 'start_date',
      'end_date', row_data ->> 'end_date'
    )
    when 'registrations' then jsonb_build_object(
      'id', row_data ->> 'id',
      'tournament_id', row_data ->> 'tournament_id',
      'player_id', row_data ->> 'player_id',
      'status', row_data ->> 'status',
      'fee_amount', row_data ->> 'fee_amount',
      'is_paid', row_data ->> 'is_paid'
    )
    when 'matches' then jsonb_build_object(
      'id', row_data ->> 'id',
      'tournament_id', row_data ->> 'tournament_id',
      'round', row_data ->> 'round',
      'status', row_data ->> 'status',
      'winner_id', row_data ->> 'winner_id',
      'winner_2_id', row_data ->> 'winner_2_id',
      'score', row_data ->> 'score',
      'scheduled_at', row_data ->> 'scheduled_at',
      'court', row_data ->> 'court'
    )
    else row_data
  end;
$$;


ALTER FUNCTION "public"."audit_payload"("table_name_input" "text", "row_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_payment_proof_object"("object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  path_parts text[];
  org_id uuid;
  tournament_id uuid;
  player_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  path_parts := string_to_array(coalesce(object_name, ''), '/');
  if array_length(path_parts, 1) <> 5 then
    return false;
  end if;

  if path_parts[1] <> 'payment-proofs' then
    return false;
  end if;

  begin
    org_id := path_parts[2]::uuid;
    tournament_id := path_parts[3]::uuid;
    player_id := path_parts[4]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and t.organization_id = org_id
      and not coalesce(t.is_tournament_master, false)
      and (
        player_id = auth.uid()
        or public.is_tournament_admin(tournament_id)
      )
  );
end;
$$;


ALTER FUNCTION "public"."can_manage_payment_proof_object"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_upload_payment_proof_object"("object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  path_parts text[];
  org_id uuid;
  tournament_id uuid;
  player_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  path_parts := string_to_array(coalesce(object_name, ''), '/');
  if array_length(path_parts, 1) <> 5 then
    return false;
  end if;

  if path_parts[1] <> 'payment-proofs' then
    return false;
  end if;

  begin
    org_id := path_parts[2]::uuid;
    tournament_id := path_parts[3]::uuid;
    player_id := path_parts[4]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if player_id <> auth.uid() then
    return false;
  end if;

  return exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and t.organization_id = org_id
      and not coalesce(t.is_tournament_master, false)
  );
end;
$$;


ALTER FUNCTION "public"."can_upload_payment_proof_object"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_push_token_when_disabled"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if coalesce(new.notifications_enabled, false) = false then
    new.expo_push_token := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."clear_push_token_when_disabled"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_championship_tournament"("p_master_tournament_id" "uuid", "p_name" "text", "p_modality" "text", "p_level" "text", "p_format" "text", "p_set_type" "text", "p_max_players" integer, "p_registration_fee" numeric, "p_description" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_championship_tournament"("p_master_tournament_id" "uuid", "p_name" "text", "p_modality" "text", "p_level" "text", "p_format" "text", "p_set_type" "text", "p_max_players" integer, "p_registration_fee" numeric, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_master_tournament"("p_organization_id" "uuid", "p_name" "text", "p_status" "text", "p_start_date" "date", "p_end_date" "date", "p_registration_close_at" "date", "p_registration_close_time" "text", "p_address" "text", "p_comuna" "text", "p_surface" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."create_master_tournament"("p_organization_id" "uuid", "p_name" "text", "p_status" "text", "p_start_date" "date", "p_end_date" "date", "p_registration_close_at" "date", "p_registration_close_time" "text", "p_address" "text", "p_comuna" "text", "p_surface" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_tournament_id" "uuid" DEFAULT NULL::"uuid", "p_match_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    tournament_id,
    match_id
  )
  values (
    p_user_id,
    p_type,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Notificación'),
    coalesce(nullif(trim(coalesce(p_body, '')), ''), 'Tienes una nueva actualización.'),
    p_tournament_id,
    p_match_id
  );
end;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_tournament_id" "uuid", "p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        coalesce(p.is_super_admin, false)
        or p.role = 'super_admin'
        or (p.role = 'admin' and p.org_id is null)
      )
  );
$$;


ALTER FUNCTION "public"."current_user_is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.org_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_profile_insert_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null and not public.current_user_is_super_admin() then
    if new.id is null or new.id <> auth.uid() then
      raise exception 'forbidden profile insert';
    end if;

    new.role := 'player';
    new.org_id := null;
    new.is_super_admin := false;
  end if;

  new.notifications_enabled := coalesce(new.notifications_enabled, false);
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_profile_insert_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_payment_approved_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'APPROVED' and (old.status is distinct from new.status) then
    insert into public.notifications_outbox (user_id, type, payload, status)
    values (
      new.user_id,
      'PAYMENT_APPROVED',
      jsonb_build_object('payment_proof_id', new.id, 'registration_id', new.registration_id, 'amount', new.amount, 'currency', new.currency),
      'PENDING'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_payment_approved_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_schedule_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = new.match_id;
  if v_match.player1_id is not null then
    insert into public.notifications_outbox (user_id, type, payload, status)
    values (
      v_match.player1_id,
      'SCHEDULE_UPDATED',
      jsonb_build_object('schedule_id', new.id, 'match_id', new.match_id, 'court_id', new.court_id, 'start_at', new.start_at, 'status', new.status),
      'PENDING'
    );
  end if;
  if v_match.player2_id is not null then
    insert into public.notifications_outbox (user_id, type, payload, status)
    values (
      v_match.player2_id,
      'SCHEDULE_UPDATED',
      jsonb_build_object('schedule_id', new.id, 'match_id', new.match_id, 'court_id', new.court_id, 'start_at', new.start_at, 'status', new.status),
      'PENDING'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_schedule_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_effective_registration_deadline"("tournament_id_input" "uuid") RETURNS timestamp without time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_effective_registration_deadline"("tournament_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_admin_push_targets"("p_tournament_id" "uuid") RETURNS TABLE("user_id" "uuid", "expo_push_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_tournament_admin_push_targets"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_player_push_targets"("p_tournament_id" "uuid", "p_player_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("user_id" "uuid", "expo_push_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_tournament_player_push_targets"("p_tournament_id" "uuid", "p_player_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  meta jsonb;
  candidate_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  candidate_name := nullif(
    trim(
      coalesce(
        meta->>'name',
        meta->>'full_name',
        meta->>'display_name',
        concat_ws(' ', meta->>'first_name', meta->>'last_name')
      )
    ),
    ''
  );

  if candidate_name is null then
    candidate_name := 'Jugador';
  end if;

  insert into public.profiles (
    id,
    name,
    role,
    is_super_admin,
    notifications_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    left(candidate_name, 80),
    'player',
    false,
    false,
    now(),
    now()
  )
  on conflict (id) do update
    set name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
        updated_at = excluded.updated_at;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_organizer"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role in ('admin', 'organizer')
  );
$$;


ALTER FUNCTION "public"."is_admin_or_organizer"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin"("org_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    auth.uid() is not null
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'organizer')
          and p.org_id = org_id_input
      )
    );
$$;


ALTER FUNCTION "public"."is_org_admin"("org_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_player"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role = 'player'
  );
$$;


ALTER FUNCTION "public"."is_player"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_registration_deadline_open"("tournament_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    case
      when deadline_value is null then true
      else timezone('America/Santiago', now())::timestamp <= deadline_value
    end
  from (
    select public.get_effective_registration_deadline(tournament_id_input) as deadline_value
  ) deadline_row;
$$;


ALTER FUNCTION "public"."is_registration_deadline_open"("tournament_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_admin"("tournament_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id_input
      and public.is_org_admin(t.organization_id)
  );
$$;


ALTER FUNCTION "public"."is_tournament_admin"("tournament_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_registration_open_for_requests"("tournament_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.tournaments child
    left join public.tournaments parent
      on parent.id = child.parent_tournament_id
    where child.id = tournament_id_input
      and not coalesce(child.is_tournament_master, false)
      and (
        (child.parent_tournament_id is null and public.normalize_tournament_status_key(child.status) in ('open', 'in_progress'))
        or (child.parent_tournament_id is not null and public.normalize_tournament_status_key(parent.status) in ('open', 'in_progress'))
      )
      and public.is_registration_deadline_open(child.id)
  );
$$;


ALTER FUNCTION "public"."is_tournament_registration_open_for_requests"("tournament_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_payment_proof_path"("proof_path_input" "text", "organization_id_input" "uuid", "tournament_id_input" "uuid", "player_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select
    proof_path_input is not null
    and length(proof_path_input) between 10 and 500
    and proof_path_input not like '%..%'
    and proof_path_input ~* (
      '^payment-proofs/' ||
      organization_id_input::text || '/' ||
      tournament_id_input::text || '/' ||
      player_id_input::text || '/[A-Za-z0-9._-]+[.](jpg|jpeg|png|webp|heic|heif)$'
    );
$_$;


ALTER FUNCTION "public"."is_valid_payment_proof_path"("proof_path_input" "text", "organization_id_input" "uuid", "tournament_id_input" "uuid", "player_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_visible_parent_tournament"("parent_tournament_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = parent_tournament_id_input
      and t.status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
  );
$$;


ALTER FUNCTION "public"."is_visible_parent_tournament"("parent_tournament_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_tournament_status_key"("status_input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  normalized_status text;
begin
  normalized_status := lower(trim(coalesce(status_input, '')));
  normalized_status := replace(replace(replace(replace(replace(normalized_status, 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u');

  if normalized_status = '' then
    return 'draft';
  end if;

  if normalized_status in ('open', 'published', 'publicado') or normalized_status like '%inscripcion abierta%' then
    return 'open';
  end if;

  if normalized_status in ('ongoing', 'in_progress', 'in progress', 'en progreso', 'en curso') then
    return 'in_progress';
  end if;

  if normalized_status in ('finished', 'completed', 'finalized', 'finalizado') then
    return 'finished';
  end if;

  if normalized_status in ('draft', 'borrador', 'no publicado') then
    return 'draft';
  end if;

  if normalized_status in ('cancelled', 'cancelado') then
    return 'cancelled';
  end if;

  return normalized_status;
end;
$$;


ALTER FUNCTION "public"."normalize_tournament_status_key"("status_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_profile_privilege_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() <> old.id and not public.current_user_is_super_admin() then
    raise exception 'forbidden profile update';
  end if;

  if not public.current_user_is_super_admin() then
    if new.role is distinct from old.role
      or new.org_id is distinct from old.org_id
      or coalesce(new.is_super_admin, false) is distinct from coalesce(old.is_super_admin, false) then
      raise exception 'cannot change privileged profile fields';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_profile_privilege_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_audit_logs"("retention_days" integer DEFAULT 365) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  deleted_count integer;
begin
  delete from public.audit_logs
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."purge_expired_audit_logs"("retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registration_requests_server_enforcer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    effective_status := public.normalize_tournament_status_key(tournament_record.parent_status);
  else
    effective_status := public.normalize_tournament_status_key(tournament_record.status);
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

    if not manager_access and effective_status not in ('open', 'in_progress') then
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


ALTER FUNCTION "public"."registration_requests_server_enforcer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrations_server_enforcer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  tournament_fee numeric(12,2);
  tournament_status text;
  manager_access boolean;
begin
  if new.tournament_id is null then
    raise exception 'tournament_id is required';
  end if;

  manager_access := public.is_tournament_admin(new.tournament_id);

  select coalesce(t.registration_fee, 0), t.status
    into tournament_fee, tournament_status
  from public.tournaments t
  where t.id = new.tournament_id;

  if tournament_status is null then
    raise exception 'tournament not found';
  end if;

  if tg_op = 'INSERT' then
    if new.player_id is null then
      new.player_id := auth.uid();
    end if;

    if new.player_id is null then
      raise exception 'player_id is required';
    end if;

    if auth.uid() is not null and new.player_id <> auth.uid() and not manager_access then
      raise exception 'cannot register another player';
    end if;

    if not manager_access then
      raise exception 'direct player registration is disabled';
    end if;

    new.fee_amount := coalesce(new.fee_amount, tournament_fee);
    new.is_paid := coalesce(new.is_paid, false);
    new.status := coalesce(new.status, 'confirmed');
    new.registered_at := coalesce(new.registered_at, now());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not manager_access then
      if new.player_id is distinct from old.player_id
        or new.tournament_id is distinct from old.tournament_id
        or new.fee_amount is distinct from old.fee_amount
        or new.is_paid is distinct from old.is_paid then
        raise exception 'forbidden registration update';
      end if;

      if new.status is distinct from old.status then
        if old.status = 'cancelled' then
          raise exception 'cancelled registration cannot be reopened';
        end if;

        if new.status <> 'cancelled' then
          raise exception 'players can only cancel their own registration';
        end if;
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."registrations_server_enforcer"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."payment_proofs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "registration_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'clp'::"text" NOT NULL,
    "method" "text" DEFAULT 'bank_transfer'::"text" NOT NULL,
    "reference" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "status" "text" DEFAULT 'SUBMITTED'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_proofs_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "payment_proofs_currency_check" CHECK (("lower"("currency") = 'clp'::"text")),
    CONSTRAINT "payment_proofs_method_check" CHECK (("method" = 'bank_transfer'::"text")),
    CONSTRAINT "payment_proofs_reference_check" CHECK (("char_length"("reference") >= 3)),
    CONSTRAINT "payment_proofs_status_check" CHECK (("status" = ANY (ARRAY['SUBMITTED'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'NEEDS_INFO'::"text"])))
);


ALTER TABLE "public"."payment_proofs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_payment_proof"("p_proof_id" "uuid", "p_status" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."payment_proofs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_proof public.payment_proofs;
begin
  if not public.is_admin_or_organizer(auth.uid()) then
    raise exception 'forbidden';
  end if;

  if p_status not in ('APPROVED', 'REJECTED', 'NEEDS_INFO') then
    raise exception 'invalid status';
  end if;

  update public.payment_proofs
  set
    status = p_status,
    notes = p_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_proof_id
  returning * into v_proof;

  if not found then
    raise exception 'payment proof not found';
  end if;

  if p_status = 'APPROVED' then
    update public.registrations
    set status = 'ACTIVE'
    where id = v_proof.registration_id;
  else
    update public.registrations
    set status = 'PENDING_PAYMENT'
    where id = v_proof.registration_id
      and status <> 'CANCELLED';
  end if;

  return v_proof;
end;
$$;


ALTER FUNCTION "public"."review_payment_proof"("p_proof_id" "uuid", "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_row_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_row_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_matches_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    p_ids UUID[];
    p_id UUID;
    v_body TEXT;
BEGIN
    -- Check if it's a new assignment (both sides filled) or schedule update (court/time)
    IF (NEW.player_a_id IS NOT NULL AND NEW.player_b_id IS NOT NULL) AND 
       ((OLD.player_a_id IS NULL OR OLD.player_b_id IS NULL) OR 
        (OLD.scheduled_at IS NULL AND NEW.scheduled_at IS NOT NULL) OR
        (OLD.court IS NULL AND NEW.court IS NOT NULL) OR
        (OLD.scheduled_at != NEW.scheduled_at) OR
        (OLD.court != NEW.court)) THEN
        
        p_ids := ARRAY[NEW.player_a_id, NEW.player_a2_id, NEW.player_b_id, NEW.player_b2_id];
        v_body := 'Tienes un nuevo partido programado para el ' || to_char(NEW.scheduled_at, 'DD/MM HH24:MI') || ' en la cancha ' || COALESCE(NEW.court, 'por confirmar');

        FOREACH p_id IN ARRAY p_ids LOOP
            IF p_id IS NOT NULL THEN
                PERFORM public.create_notification(
                    p_id,
                    'match_start',
                    'Nuevo Enfrentamiento',
                    v_body,
                    NEW.tournament_id,
                    NEW.id
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tr_matches_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_new_tournament_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    player_rec RECORD;
BEGIN
    -- Notify players who have registered in this organization and level before
    FOR player_rec IN 
        SELECT DISTINCT r.player_id 
        FROM public.registrations r
        JOIN public.tournaments t ON r.tournament_id = t.id
        WHERE t.organization_id = NEW.organization_id 
          AND t.level = NEW.level
    LOOP
        PERFORM public.create_notification(
            player_rec.player_id,
            'registration',
            'Nuevo Torneo Disponible',
            'Se ha creado un nuevo torneo: "' || NEW.name || '" (' || NEW.level || ') en su club.',
            NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tr_new_tournament_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_tournaments_status_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    reg RECORD;
BEGIN
    IF (NEW.status IN ('in_progress', 'finished') AND OLD.status != NEW.status) THEN
        FOR reg IN SELECT player_id FROM public.registrations WHERE tournament_id = NEW.id AND status = 'confirmed' LOOP
            PERFORM public.create_notification(
                reg.player_id,
                'info',
                CASE WHEN NEW.status = 'in_progress' THEN 'Torneo en Proceso' ELSE 'Torneo Finalizado' END,
                'El torneo "' || NEW.name || '" ha cambiado su estado a ' || 
                CASE WHEN NEW.status = 'in_progress' THEN 'En Proceso' ELSE 'Finalizado' END,
                NEW.id
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tr_tournaments_status_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_match_winners"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.winner_id is not null and new.winner_id <> new.player_a_id and new.winner_id <> new.player_b_id then
    raise exception 'winner_id must be a match player';
  end if;

  if new.winner_2_id is not null and new.winner_2_id <> new.player_a2_id and new.winner_2_id <> new.player_b2_id then
    raise exception 'winner_2_id must be a doubles match partner';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_match_winners"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_table" "text" NOT NULL,
    "entity_id" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "court_blocks_check" CHECK (("end_at" > "start_at"))
);


ALTER TABLE "public"."court_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."draws" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'single_elim'::"text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rr_top_k" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "draws_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text"]))),
    CONSTRAINT "draws_type_check" CHECK (("type" = ANY (ARRAY['single_elim'::"text", 'round_robin'::"text", 'rr_to_elim'::"text"])))
);


ALTER TABLE "public"."draws" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "match_id" "uuid",
    "event_type" "text",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['score_update'::"text", 'set_won'::"text", 'match_end'::"text", 'match_start'::"text"])))
);


ALTER TABLE "public"."match_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid",
    "player_a_id" "uuid",
    "player_b_id" "uuid",
    "winner_id" "uuid",
    "round" "text",
    "group_name" "text",
    "score" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "scheduled_at" timestamp with time zone,
    "court" "text",
    "round_number" integer,
    "match_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_a2_id" "uuid",
    "player_b2_id" "uuid",
    "winner_2_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'live'::"text", 'finished'::"text"])))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_reads" (
    "notification_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "tournament_id" "uuid",
    "match_id" "uuid",
    "type" "text",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['match_start'::"text", 'result'::"text", 'round_advance'::"text", 'info'::"text", 'registration'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_outbox_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'SENT'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."notifications_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "slug" "text",
    "owner_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "logo_url" "text",
    "contact_email" "text",
    "contact_whatsapp" "text",
    "social_links" "text",
    "photos_drive_url" "text",
    CONSTRAINT "organizations_contact_whatsapp_format_chk" CHECK ((("contact_whatsapp" IS NULL) OR (("length"("contact_whatsapp") <= 30) AND ("contact_whatsapp" ~ '^[0-9+()\\-\\s]*$'::"text")))),
    CONSTRAINT "organizations_photos_drive_url_format_chk" CHECK ((("photos_drive_url" IS NULL) OR (("length"("photos_drive_url") <= 500) AND ("photos_drive_url" ~* '^https?://.+'::"text")))),
    CONSTRAINT "organizations_social_links_length_chk" CHECK ((("social_links" IS NULL) OR ("length"("social_links") <= 500)))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organizations_public" WITH ("security_barrier"='true') AS
 SELECT "id",
    "name",
    "slug",
    "logo_url",
    "created_at",
    "contact_email",
    "contact_whatsapp",
    "social_links",
    "photos_drive_url"
   FROM "public"."organizations" "o";


ALTER VIEW "public"."organizations_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "phone" "text",
    "club_name" "text",
    "level" "text",
    "constraints" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "qa_tag" "text",
    "org_id" "uuid",
    "location" "text",
    "avatar_url" "text",
    "bio" "text",
    "revés" "text",
    "mano_dominante" "text",
    "email" "text",
    "notifications_enabled" boolean DEFAULT true,
    "expo_push_token" "text",
    "is_super_admin" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_level_check" CHECK (("level" = ANY (ARRAY['Cuarta'::"text", 'Tercera'::"text", 'Honor'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['player'::"text", 'organizer'::"text", 'admin'::"text", 'referee'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_profiles" WITH ("security_barrier"='true') AS
 SELECT "id",
    COALESCE(NULLIF(TRIM(BOTH FROM "name"), ''::"text"), 'Jugador'::"text") AS "name",
    "avatar_url"
   FROM "public"."profiles" "p";


ALTER VIEW "public"."public_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid",
    "player_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "seed" integer,
    "registered_at" timestamp with time zone DEFAULT "now"(),
    "fee_amount" integer DEFAULT 0,
    "is_paid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "registrations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rr_group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "seed" integer,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "manual_name" "text"
);


ALTER TABLE "public"."rr_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rr_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draw_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rr_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "court_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'SCHEDULED'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedules_status_check" CHECK (("status" = ANY (ARRAY['SCHEDULED'::"text", 'IN_PLAY'::"text", 'DELAYED'::"text", 'DONE'::"text"])))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_registration_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "proof_path" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "approved_registration_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_registration_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "format" "text" NOT NULL,
    "surface" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "level" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "max_players" integer NOT NULL,
    "city" "text",
    "venue" "text",
    "prize_info" "jsonb",
    "cover_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid",
    "set_type" "text" DEFAULT 'Al mejor de 3 Sets'::"text",
    "registration_fee" integer DEFAULT 0,
    "address" "text",
    "comuna" "text",
    "modality" "text" DEFAULT 'singles'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_tournament_id" "uuid",
    "is_tournament_master" boolean DEFAULT false NOT NULL,
    "registration_close_at" "date",
    "registration_close_time" time without time zone,
    "poster_url" "text",
    CONSTRAINT "check_modality" CHECK (("modality" = ANY (ARRAY['singles'::"text", 'dobles'::"text"]))),
    CONSTRAINT "tournaments_format_check" CHECK (("format" = ANY (ARRAY['Eliminación Directa'::"text", 'Round Robin'::"text", 'Eliminación Directa con Repechaje'::"text"]))),
    CONSTRAINT "tournaments_level_check" CHECK (("level" = ANY (ARRAY['Escalafón'::"text", 'Honor'::"text", '1ra'::"text", '2da'::"text", '3ra'::"text", '4ta'::"text", '5ta'::"text", 'Inicial'::"text"]))),
    CONSTRAINT "tournaments_set_type_check" CHECK (("set_type" = ANY (ARRAY['Al mejor de 3 Sets'::"text", 'Set Corto'::"text", 'Al mejor de 5 Sets'::"text"]))),
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'in_progress'::"text", 'finished'::"text"]))),
    CONSTRAINT "tournaments_surface_check" CHECK (("surface" = ANY (ARRAY['Arcilla'::"text", 'Dura'::"text", 'Césped'::"text", 'Carpeta'::"text", 'clay'::"text", 'hard'::"text", 'grass'::"text", 'carpet'::"text"])))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tournaments"."organization_id" IS 'Specific organization this tournament belongs to.';



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_blocks"
    ADD CONSTRAINT "court_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."draws"
    ADD CONSTRAINT "draws_category_id_key" UNIQUE ("category_id");



ALTER TABLE ONLY "public"."draws"
    ADD CONSTRAINT "draws_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."matches"
    ADD CONSTRAINT "matches_round_number_positive_chk" CHECK ((("round_number" IS NULL) OR ("round_number" >= 1))) NOT VALID;



ALTER TABLE "public"."matches"
    ADD CONSTRAINT "matches_status_allowed_chk" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'scheduled'::"text", 'live'::"text", 'finished'::"text", 'cancelled'::"text", 'walkover'::"text"])))) NOT VALID;



ALTER TABLE "public"."matches"
    ADD CONSTRAINT "matches_winner_partner_chk" CHECK ((("winner_2_id" IS NULL) OR ("winner_2_id" = "player_a2_id") OR ("winner_2_id" = "player_b2_id"))) NOT VALID;



ALTER TABLE "public"."matches"
    ADD CONSTRAINT "matches_winner_player_chk" CHECK ((("winner_id" IS NULL) OR ("winner_id" = "player_a_id") OR ("winner_id" = "player_b_id"))) NOT VALID;



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id", "profile_id");



ALTER TABLE ONLY "public"."notifications_outbox"
    ADD CONSTRAINT "notifications_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."organizations"
    ADD CONSTRAINT "organizations_contact_email_format_chk" CHECK ((("contact_email" IS NULL) OR (("length"("contact_email") <= 120) AND ("contact_email" ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::"text")))) NOT VALID;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_role_allowed_chk" CHECK ((("role" IS NULL) OR ("role" = ANY (ARRAY['player'::"text", 'organizer'::"text", 'admin'::"text", 'super_admin'::"text"])))) NOT VALID;



ALTER TABLE "public"."registrations"
    ADD CONSTRAINT "registrations_fee_non_negative_chk" CHECK ((COALESCE("fee_amount", 0) >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."registrations"
    ADD CONSTRAINT "registrations_status_allowed_chk" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text", 'rejected'::"text"])))) NOT VALID;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_tournament_id_player_id_key" UNIQUE ("tournament_id", "player_id");



ALTER TABLE ONLY "public"."rr_group_members"
    ADD CONSTRAINT "rr_group_members_group_id_sort_order_key" UNIQUE ("group_id", "sort_order");



ALTER TABLE ONLY "public"."rr_group_members"
    ADD CONSTRAINT "rr_group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."rr_group_members"
    ADD CONSTRAINT "rr_group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rr_groups"
    ADD CONSTRAINT "rr_groups_draw_id_name_key" UNIQUE ("draw_id", "name");



ALTER TABLE ONLY "public"."rr_groups"
    ADD CONSTRAINT "rr_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_match_id_key" UNIQUE ("match_id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_proof_path_chk" CHECK (((("length"("proof_path") >= 10) AND ("length"("proof_path") <= 500)) AND ("proof_path" !~~ '%..%'::"text") AND ("proof_path" ~* '^payment-proofs/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+/[A-Za-z0-9._-]+[.](jpg|jpeg|png|webp|heic|heif)$'::"text"))) NOT VALID;



ALTER TABLE "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_rejection_reason_chk" CHECK (((("status" <> 'rejected'::"text") AND ("rejection_reason" IS NULL)) OR (("status" = 'rejected'::"text") AND (("length"(TRIM(BOTH FROM COALESCE("rejection_reason", ''::"text"))) >= 3) AND ("length"(TRIM(BOTH FROM COALESCE("rejection_reason", ''::"text"))) <= 250))))) NOT VALID;



ALTER TABLE "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_child_registration_deadline_null_chk" CHECK ((("parent_tournament_id" IS NULL) OR (("registration_close_at" IS NULL) AND ("registration_close_time" IS NULL)))) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_master_parent_null_chk" CHECK (((NOT "is_tournament_master") OR ("parent_tournament_id" IS NULL))) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_max_players_positive_chk" CHECK ((("max_players" IS NULL) OR (("max_players" >= 2) AND ("max_players" <= 256)))) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_parent_not_self_chk" CHECK ((("parent_tournament_id" IS NULL) OR ("parent_tournament_id" <> "id"))) NOT VALID;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_registration_close_after_start_chk" CHECK ((("registration_close_at" IS NULL) OR ("start_date" IS NULL) OR ("registration_close_at" <= "start_date"))) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_registration_close_time_requires_date_chk" CHECK ((("registration_close_time" IS NULL) OR ("registration_close_at" IS NOT NULL))) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_registration_fee_non_negative_chk" CHECK ((COALESCE("registration_fee", 0) >= 0)) NOT VALID;



ALTER TABLE "public"."tournaments"
    ADD CONSTRAINT "tournaments_status_allowed_chk" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'ongoing'::"text", 'in_progress'::"text", 'finished'::"text", 'completed'::"text", 'finalized'::"text", 'cancelled'::"text"])))) NOT VALID;



CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_table", "entity_id", "created_at" DESC);



CREATE INDEX "idx_court_blocks_court_time" ON "public"."court_blocks" USING "btree" ("court_id", "start_at", "end_at");



CREATE INDEX "idx_draws_category_id" ON "public"."draws" USING "btree" ("category_id");



CREATE INDEX "idx_draws_status" ON "public"."draws" USING "btree" ("status");



CREATE INDEX "idx_notifications_outbox_status" ON "public"."notifications_outbox" USING "btree" ("status");



CREATE INDEX "idx_notifications_outbox_user_id" ON "public"."notifications_outbox" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_payment_proofs_created_at" ON "public"."payment_proofs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_payment_proofs_registration_id" ON "public"."payment_proofs" USING "btree" ("registration_id");



CREATE INDEX "idx_payment_proofs_status" ON "public"."payment_proofs" USING "btree" ("status");



CREATE INDEX "idx_payment_proofs_user_id" ON "public"."payment_proofs" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_org_id" ON "public"."profiles" USING "btree" ("org_id");



CREATE INDEX "idx_profiles_qa_tag" ON "public"."profiles" USING "btree" ("qa_tag");



CREATE INDEX "idx_rr_group_members_group_id" ON "public"."rr_group_members" USING "btree" ("group_id");



CREATE INDEX "idx_rr_group_members_user_id" ON "public"."rr_group_members" USING "btree" ("user_id");



CREATE INDEX "idx_rr_groups_draw_id" ON "public"."rr_groups" USING "btree" ("draw_id");



CREATE INDEX "idx_schedules_court" ON "public"."schedules" USING "btree" ("court_id", "status");



CREATE INDEX "idx_schedules_start" ON "public"."schedules" USING "btree" ("start_at");



CREATE INDEX "matches_player_a_idx" ON "public"."matches" USING "btree" ("player_a_id");



CREATE INDEX "matches_player_b_idx" ON "public"."matches" USING "btree" ("player_b_id");



CREATE INDEX "matches_tournament_round_idx" ON "public"."matches" USING "btree" ("tournament_id", "round_number", "match_order");



CREATE INDEX "profiles_org_role_idx" ON "public"."profiles" USING "btree" ("org_id", "role");



CREATE INDEX "registrations_player_idx" ON "public"."registrations" USING "btree" ("player_id");



CREATE INDEX "registrations_tournament_idx" ON "public"."registrations" USING "btree" ("tournament_id");



CREATE INDEX "registrations_tournament_player_status_idx" ON "public"."registrations" USING "btree" ("tournament_id", "player_id", "status");



CREATE UNIQUE INDEX "registrations_tournament_player_uidx" ON "public"."registrations" USING "btree" ("tournament_id", "player_id");



CREATE UNIQUE INDEX "tournament_registration_requests_pending_uidx" ON "public"."tournament_registration_requests" USING "btree" ("tournament_id", "player_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "tournament_registration_requests_player_status_idx" ON "public"."tournament_registration_requests" USING "btree" ("player_id", "status", "updated_at" DESC);



CREATE INDEX "tournament_registration_requests_tournament_status_idx" ON "public"."tournament_registration_requests" USING "btree" ("tournament_id", "status", "created_at" DESC);



CREATE INDEX "tournaments_master_status_start_idx" ON "public"."tournaments" USING "btree" ("organization_id", "is_tournament_master", "status", "start_date");



CREATE INDEX "tournaments_org_status_start_idx" ON "public"."tournaments" USING "btree" ("organization_id", "status", "start_date");



CREATE INDEX "tournaments_parent_tournament_idx" ON "public"."tournaments" USING "btree" ("parent_tournament_id");



CREATE INDEX "tournaments_status_idx" ON "public"."tournaments" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "matches_notify_trigger" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."tr_matches_notify"();



CREATE OR REPLACE TRIGGER "new_tournament_notify_trigger" AFTER INSERT ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."tr_new_tournament_notify"();



CREATE OR REPLACE TRIGGER "set_matches_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_registrations_updated_at" BEFORE UPDATE ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_tournament_registration_requests_updated_at" BEFORE UPDATE ON "public"."tournament_registration_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_tournaments_updated_at" BEFORE UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "tournaments_status_notify_trigger" AFTER UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."tr_tournaments_status_notify"();



CREATE OR REPLACE TRIGGER "trg_audit_matches" AFTER INSERT OR DELETE OR UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "trg_audit_profiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "trg_audit_registrations" AFTER INSERT OR DELETE OR UPDATE ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "trg_audit_tournament_registration_requests" AFTER INSERT OR DELETE OR UPDATE ON "public"."tournament_registration_requests" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "trg_audit_tournaments" AFTER INSERT OR DELETE OR UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "trg_matches_validate_winners" BEFORE INSERT OR UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."validate_match_winners"();



CREATE OR REPLACE TRIGGER "trg_payment_approved_notification" AFTER UPDATE ON "public"."payment_proofs" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_payment_approved_notification"();



CREATE OR REPLACE TRIGGER "trg_profiles_clear_push_token" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."clear_push_token_when_disabled"();



CREATE OR REPLACE TRIGGER "trg_profiles_enforce_insert_defaults" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_profile_insert_defaults"();



CREATE OR REPLACE TRIGGER "trg_profiles_prevent_privilege_escalation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_profile_privilege_escalation"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_registration_requests_server_enforcer" BEFORE INSERT OR UPDATE ON "public"."tournament_registration_requests" FOR EACH ROW EXECUTE FUNCTION "public"."registration_requests_server_enforcer"();



CREATE OR REPLACE TRIGGER "trg_registrations_server_enforcer" BEFORE INSERT OR UPDATE ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."registrations_server_enforcer"();



CREATE OR REPLACE TRIGGER "trg_schedule_notification" AFTER INSERT OR UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_schedule_notification"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."court_blocks"
    ADD CONSTRAINT "court_blocks_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draws"
    ADD CONSTRAINT "draws_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_a2_fk_hardened" FOREIGN KEY ("player_a2_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_a2_id_fkey" FOREIGN KEY ("player_a2_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_a_fk_hardened" FOREIGN KEY ("player_a_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_b2_fk_hardened" FOREIGN KEY ("player_b2_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_b2_id_fkey" FOREIGN KEY ("player_b2_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_b_fk_hardened" FOREIGN KEY ("player_b_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_fk_hardened" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE NOT VALID;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_2_id_fkey" FOREIGN KEY ("winner_2_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications_outbox"
    ADD CONSTRAINT "notifications_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fk_hardened" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_player_fk_hardened" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE NOT VALID;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_tournament_fk_hardened" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE NOT VALID;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rr_group_members"
    ADD CONSTRAINT "rr_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."rr_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rr_group_members"
    ADD CONSTRAINT "rr_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rr_groups"
    ADD CONSTRAINT "rr_groups_draw_id_fkey" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_approved_registration_id_fkey" FOREIGN KEY ("approved_registration_id") REFERENCES "public"."registrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_registration_requests"
    ADD CONSTRAINT "tournament_registration_requests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_org_id_fk_hardened" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT NOT VALID;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_parent_tournament_fk" FOREIGN KEY ("parent_tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE NOT VALID;



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select_super_admin" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."current_user_is_super_admin"());



ALTER TABLE "public"."court_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "court_blocks_cud_admin_organizer" ON "public"."court_blocks" TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "court_blocks_select_authenticated" ON "public"."court_blocks" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."courts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courts_cud_admin_organizer" ON "public"."courts" TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "courts_select_authenticated" ON "public"."courts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."draws" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "draws_insert_admin_organizer" ON "public"."draws" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_or_organizer"("auth"."uid"()) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "draws_select_authenticated" ON "public"."draws" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "draws_update_admin_organizer" ON "public"."draws" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_delete_policy" ON "public"."matches" FOR DELETE TO "authenticated" USING ("public"."is_tournament_admin"("tournament_id"));



CREATE POLICY "matches_insert_policy" ON "public"."matches" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tournament_admin"("tournament_id"));



CREATE POLICY "matches_select_policy" ON "public"."matches" FOR SELECT TO "authenticated" USING (("public"."is_tournament_admin"("tournament_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "matches"."tournament_id") AND ("t"."status" = ANY (ARRAY['open'::"text", 'ongoing'::"text", 'in_progress'::"text", 'finished'::"text", 'completed'::"text", 'finalized'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."registrations" "r"
  WHERE (("r"."tournament_id" = "matches"."tournament_id") AND ("r"."player_id" = "auth"."uid"()))))));



CREATE POLICY "matches_update_policy" ON "public"."matches" FOR UPDATE TO "authenticated" USING ("public"."is_tournament_admin"("tournament_id")) WITH CHECK ("public"."is_tournament_admin"("tournament_id"));



ALTER TABLE "public"."notification_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_reads_insert_own" ON "public"."notification_reads" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "notification_reads_select_own" ON "public"."notification_reads" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications_outbox" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_outbox_insert_admin_organizer" ON "public"."notifications_outbox" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "notifications_outbox_select" ON "public"."notifications_outbox" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin_or_organizer"("auth"."uid"())));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_delete_policy" ON "public"."organizations" FOR DELETE TO "authenticated" USING ("public"."current_user_is_super_admin"());



CREATE POLICY "organizations_insert_policy" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_is_super_admin"());



CREATE POLICY "organizations_select_policy" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("public"."current_user_is_super_admin"() OR "public"."is_org_admin"("id")));



CREATE POLICY "organizations_update_policy" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ("public"."is_org_admin"("id")) WITH CHECK ("public"."is_org_admin"("id"));



ALTER TABLE "public"."payment_proofs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_proofs_insert_player_self" ON "public"."payment_proofs" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_player"("auth"."uid"()) AND ("status" = 'SUBMITTED'::"text") AND ("reviewed_by" IS NULL) AND ("reviewed_at" IS NULL) AND ("method" = 'bank_transfer'::"text")));



CREATE POLICY "payment_proofs_select_self_or_admin_organizer" ON "public"."payment_proofs" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin_or_organizer"("auth"."uid"())));



CREATE POLICY "payment_proofs_update_admin_organizer" ON "public"."payment_proofs" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_policy" ON "public"."profiles" FOR DELETE TO "authenticated" USING ("public"."current_user_is_super_admin"());



CREATE POLICY "profiles_insert_policy" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_super_admin"() OR (("id" = "auth"."uid"()) AND (COALESCE("is_super_admin", false) = false) AND (COALESCE("role", 'player'::"text") = 'player'::"text") AND ("org_id" IS NULL))));



CREATE POLICY "profiles_select_policy" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."current_user_is_super_admin"() OR (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'organizer'::"text"])) AND ("org_id" = "public"."current_user_org_id"()))));



CREATE POLICY "profiles_update_policy" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."current_user_is_super_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."current_user_is_super_admin"()));



ALTER TABLE "public"."registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "registrations_delete_policy" ON "public"."registrations" FOR DELETE TO "authenticated" USING (("public"."is_tournament_admin"("tournament_id") OR (("player_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "registrations"."tournament_id") AND ("t"."status" = ANY (ARRAY['open'::"text", 'ongoing'::"text", 'in_progress'::"text"]))))))));



CREATE POLICY "registrations_insert_policy" ON "public"."registrations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tournament_admin"("tournament_id"));



CREATE POLICY "registrations_select_policy" ON "public"."registrations" FOR SELECT TO "authenticated" USING ((("player_id" = "auth"."uid"()) OR "public"."is_tournament_admin"("tournament_id")));



CREATE POLICY "registrations_update_policy" ON "public"."registrations" FOR UPDATE TO "authenticated" USING (("public"."is_tournament_admin"("tournament_id") OR (("player_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "registrations"."tournament_id") AND ("t"."status" = ANY (ARRAY['open'::"text", 'ongoing'::"text", 'in_progress'::"text"])))))))) WITH CHECK (("public"."is_tournament_admin"("tournament_id") OR (("player_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "registrations"."tournament_id") AND ("t"."status" = ANY (ARRAY['open'::"text", 'ongoing'::"text", 'in_progress'::"text"]))))))));



ALTER TABLE "public"."rr_group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rr_group_members_delete_admin_organizer" ON "public"."rr_group_members" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "rr_group_members_insert_admin_organizer" ON "public"."rr_group_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "rr_group_members_select_authenticated" ON "public"."rr_group_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rr_group_members_update_admin_organizer" ON "public"."rr_group_members" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



ALTER TABLE "public"."rr_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rr_groups_delete_admin_organizer" ON "public"."rr_groups" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "rr_groups_insert_admin_organizer" ON "public"."rr_groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "rr_groups_select_authenticated" ON "public"."rr_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rr_groups_update_admin_organizer" ON "public"."rr_groups" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_cud_admin_organizer" ON "public"."schedules" TO "authenticated" USING ("public"."is_admin_or_organizer"("auth"."uid"())) WITH CHECK ("public"."is_admin_or_organizer"("auth"."uid"()));



CREATE POLICY "schedules_select_authenticated" ON "public"."schedules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."tournament_registration_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_registration_requests_delete_policy" ON "public"."tournament_registration_requests" FOR DELETE TO "authenticated" USING ("public"."is_tournament_admin"("tournament_id"));



CREATE POLICY "tournament_registration_requests_insert_policy" ON "public"."tournament_registration_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (COALESCE("player_id", "auth"."uid"()) = "auth"."uid"())));



CREATE POLICY "tournament_registration_requests_select_policy" ON "public"."tournament_registration_requests" FOR SELECT TO "authenticated" USING ((("player_id" = "auth"."uid"()) OR "public"."is_tournament_admin"("tournament_id")));



CREATE POLICY "tournament_registration_requests_update_policy" ON "public"."tournament_registration_requests" FOR UPDATE TO "authenticated" USING ("public"."is_tournament_admin"("tournament_id")) WITH CHECK ("public"."is_tournament_admin"("tournament_id"));



ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_delete_policy" ON "public"."tournaments" FOR DELETE TO "authenticated" USING ("public"."is_tournament_admin"("id"));



CREATE POLICY "tournaments_insert_policy" ON "public"."tournaments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_admin"("organization_id"));



CREATE POLICY "tournaments_select_policy" ON "public"."tournaments" FOR SELECT TO "authenticated" USING (("public"."is_org_admin"("organization_id") OR (("parent_tournament_id" IS NULL) AND ("status" = ANY (ARRAY['open'::"text", 'ongoing'::"text", 'in_progress'::"text", 'finished'::"text", 'completed'::"text", 'finalized'::"text"]))) OR (("parent_tournament_id" IS NOT NULL) AND "public"."is_visible_parent_tournament"("parent_tournament_id"))));



CREATE POLICY "tournaments_update_policy" ON "public"."tournaments" FOR UPDATE TO "authenticated" USING ("public"."is_tournament_admin"("id")) WITH CHECK ("public"."is_tournament_admin"("id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."audit_log_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_log_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."audit_payload"("table_name_input" "text", "row_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_payload"("table_name_input" "text", "row_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."audit_payload"("table_name_input" "text", "row_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_payload"("table_name_input" "text", "row_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_payment_proof_object"("object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_payment_proof_object"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_payment_proof_object"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_payment_proof_object"("object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_upload_payment_proof_object"("object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_upload_payment_proof_object"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_upload_payment_proof_object"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_upload_payment_proof_object"("object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_push_token_when_disabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_push_token_when_disabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_push_token_when_disabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_push_token_when_disabled"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_championship_tournament"("p_master_tournament_id" "uuid", "p_name" "text", "p_modality" "text", "p_level" "text", "p_format" "text", "p_set_type" "text", "p_max_players" integer, "p_registration_fee" numeric, "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_championship_tournament"("p_master_tournament_id" "uuid", "p_name" "text", "p_modality" "text", "p_level" "text", "p_format" "text", "p_set_type" "text", "p_max_players" integer, "p_registration_fee" numeric, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_championship_tournament"("p_master_tournament_id" "uuid", "p_name" "text", "p_modality" "text", "p_level" "text", "p_format" "text", "p_set_type" "text", "p_max_players" integer, "p_registration_fee" numeric, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_championship_tournament"("p_master_tournament_id" "uuid", "p_name" "text", "p_modality" "text", "p_level" "text", "p_format" "text", "p_set_type" "text", "p_max_players" integer, "p_registration_fee" numeric, "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_master_tournament"("p_organization_id" "uuid", "p_name" "text", "p_status" "text", "p_start_date" "date", "p_end_date" "date", "p_registration_close_at" "date", "p_registration_close_time" "text", "p_address" "text", "p_comuna" "text", "p_surface" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_master_tournament"("p_organization_id" "uuid", "p_name" "text", "p_status" "text", "p_start_date" "date", "p_end_date" "date", "p_registration_close_at" "date", "p_registration_close_time" "text", "p_address" "text", "p_comuna" "text", "p_surface" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_master_tournament"("p_organization_id" "uuid", "p_name" "text", "p_status" "text", "p_start_date" "date", "p_end_date" "date", "p_registration_close_at" "date", "p_registration_close_time" "text", "p_address" "text", "p_comuna" "text", "p_surface" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_master_tournament"("p_organization_id" "uuid", "p_name" "text", "p_status" "text", "p_start_date" "date", "p_end_date" "date", "p_registration_close_at" "date", "p_registration_close_time" "text", "p_address" "text", "p_comuna" "text", "p_surface" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_tournament_id" "uuid", "p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_tournament_id" "uuid", "p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_tournament_id" "uuid", "p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_tournament_id" "uuid", "p_match_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_is_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_is_super_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_org_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_org_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_own_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_profile_insert_defaults"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_profile_insert_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_profile_insert_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_profile_insert_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_payment_approved_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_payment_approved_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_payment_approved_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_schedule_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_schedule_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_schedule_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_effective_registration_deadline"("tournament_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_effective_registration_deadline"("tournament_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_effective_registration_deadline"("tournament_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_registration_deadline"("tournament_id_input" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_tournament_admin_push_targets"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_tournament_admin_push_targets"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_admin_push_targets"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_admin_push_targets"("p_tournament_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_tournament_player_push_targets"("p_tournament_id" "uuid", "p_player_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_tournament_player_push_targets"("p_tournament_id" "uuid", "p_player_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_player_push_targets"("p_tournament_id" "uuid", "p_player_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_player_push_targets"("p_tournament_id" "uuid", "p_player_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_auth_user_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_organizer"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_organizer"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_organizer"("check_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_org_admin"("org_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_player"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_player"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_player"("check_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_registration_deadline_open"("tournament_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_registration_deadline_open"("tournament_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_registration_deadline_open"("tournament_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_registration_deadline_open"("tournament_id_input" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_tournament_admin"("tournament_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_tournament_admin"("tournament_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_admin"("tournament_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_admin"("tournament_id_input" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_tournament_registration_open_for_requests"("tournament_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_tournament_registration_open_for_requests"("tournament_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_registration_open_for_requests"("tournament_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_registration_open_for_requests"("tournament_id_input" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_valid_payment_proof_path"("proof_path_input" "text", "organization_id_input" "uuid", "tournament_id_input" "uuid", "player_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_valid_payment_proof_path"("proof_path_input" "text", "organization_id_input" "uuid", "tournament_id_input" "uuid", "player_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_payment_proof_path"("proof_path_input" "text", "organization_id_input" "uuid", "tournament_id_input" "uuid", "player_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_payment_proof_path"("proof_path_input" "text", "organization_id_input" "uuid", "tournament_id_input" "uuid", "player_id_input" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_visible_parent_tournament"("parent_tournament_id_input" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_visible_parent_tournament"("parent_tournament_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_visible_parent_tournament"("parent_tournament_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_visible_parent_tournament"("parent_tournament_id_input" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_tournament_status_key"("status_input" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_tournament_status_key"("status_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_tournament_status_key"("status_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_tournament_status_key"("status_input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_expired_audit_logs"("retention_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_expired_audit_logs"("retention_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_audit_logs"("retention_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_audit_logs"("retention_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."registration_requests_server_enforcer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registration_requests_server_enforcer"() TO "anon";
GRANT ALL ON FUNCTION "public"."registration_requests_server_enforcer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registration_requests_server_enforcer"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrations_server_enforcer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrations_server_enforcer"() TO "anon";
GRANT ALL ON FUNCTION "public"."registrations_server_enforcer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrations_server_enforcer"() TO "service_role";



GRANT ALL ON TABLE "public"."payment_proofs" TO "anon";
GRANT ALL ON TABLE "public"."payment_proofs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_proofs" TO "service_role";



GRANT ALL ON FUNCTION "public"."review_payment_proof"("p_proof_id" "uuid", "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."review_payment_proof"("p_proof_id" "uuid", "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_payment_proof"("p_proof_id" "uuid", "p_status" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_row_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tr_matches_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."tr_matches_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tr_matches_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tr_new_tournament_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."tr_new_tournament_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tr_new_tournament_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tr_tournaments_status_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."tr_tournaments_status_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tr_tournaments_status_notify"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_match_winners"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_match_winners"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_match_winners"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_match_winners"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."court_blocks" TO "anon";
GRANT ALL ON TABLE "public"."court_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."court_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."courts" TO "anon";
GRANT ALL ON TABLE "public"."courts" TO "authenticated";
GRANT ALL ON TABLE "public"."courts" TO "service_role";



GRANT ALL ON TABLE "public"."draws" TO "anon";
GRANT ALL ON TABLE "public"."draws" TO "authenticated";
GRANT ALL ON TABLE "public"."draws" TO "service_role";



GRANT ALL ON TABLE "public"."match_events" TO "anon";
GRANT ALL ON TABLE "public"."match_events" TO "authenticated";
GRANT ALL ON TABLE "public"."match_events" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."notification_reads" TO "anon";
GRANT ALL ON TABLE "public"."notification_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_reads" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."notifications_outbox" TO "anon";
GRANT ALL ON TABLE "public"."notifications_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."organizations_public" TO "anon";
GRANT ALL ON TABLE "public"."organizations_public" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations_public" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."public_profiles" TO "anon";
GRANT ALL ON TABLE "public"."public_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."public_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."registrations" TO "anon";
GRANT ALL ON TABLE "public"."registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."registrations" TO "service_role";



GRANT ALL ON TABLE "public"."rr_group_members" TO "anon";
GRANT ALL ON TABLE "public"."rr_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."rr_group_members" TO "service_role";



GRANT ALL ON TABLE "public"."rr_groups" TO "anon";
GRANT ALL ON TABLE "public"."rr_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."rr_groups" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_registration_requests" TO "anon";
GRANT ALL ON TABLE "public"."tournament_registration_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_registration_requests" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































