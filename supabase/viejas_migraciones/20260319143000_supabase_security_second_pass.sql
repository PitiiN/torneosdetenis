-- Supabase security deep pass (second round)
-- Focus: tighter RLS semantics, privilege hardening, and safer read surfaces.

begin;

-- -----------------------------------------------------------------------------
-- Safe public read surfaces (limited columns)
-- -----------------------------------------------------------------------------

create or replace view public.organizations_public
with (security_barrier = true)
as
select
  o.id,
  o.name,
  o.slug,
  o.logo_url,
  o.created_at
from public.organizations o;

create or replace view public.public_profiles
with (security_barrier = true)
as
select
  p.id,
  coalesce(nullif(trim(p.name), ''), 'Jugador') as name,
  p.avatar_url
from public.profiles p;

revoke all on public.organizations_public from public;
revoke all on public.public_profiles from public;
grant select on public.organizations_public to authenticated;
grant select on public.organizations_public to service_role;
grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to service_role;

-- -----------------------------------------------------------------------------
-- RLS tightening
-- -----------------------------------------------------------------------------

drop policy if exists organizations_select_policy on public.organizations;
create policy organizations_select_policy
on public.organizations
for select
to authenticated
using (
  public.current_user_is_super_admin()
  or public.is_org_admin(id)
);

drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_super_admin()
  or (
    public.current_user_role() in ('admin', 'organizer')
    and org_id = public.current_user_org_id()
  )
);

drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy
on public.profiles
for insert
to authenticated
with check (
  public.current_user_is_super_admin()
  or (
    id = auth.uid()
    and coalesce(is_super_admin, false) = false
    and coalesce(role, 'player') = 'player'
    and org_id is null
  )
);

create or replace function public.enforce_profile_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists trg_profiles_enforce_insert_defaults on public.profiles;
create trigger trg_profiles_enforce_insert_defaults
before insert on public.profiles
for each row execute function public.enforce_profile_insert_defaults();

create or replace function public.registrations_server_enforcer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

    if not manager_access and tournament_status not in ('open', 'ongoing', 'in_progress') then
      raise exception 'registration is closed';
    end if;

    if manager_access then
      new.fee_amount := coalesce(new.fee_amount, tournament_fee);
      new.is_paid := coalesce(new.is_paid, false);
      new.status := coalesce(new.status, 'confirmed');
    else
      new.fee_amount := tournament_fee;
      new.is_paid := false;
      new.status := 'confirmed';
    end if;

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

drop policy if exists registrations_update_policy on public.registrations;
create policy registrations_update_policy
on public.registrations
for update
to authenticated
using (
  public.is_tournament_admin(tournament_id)
  or (
    player_id = auth.uid()
    and exists (
      select 1
      from public.tournaments t
      where t.id = registrations.tournament_id
        and t.status in ('open', 'ongoing', 'in_progress')
    )
  )
)
with check (
  public.is_tournament_admin(tournament_id)
  or (
    player_id = auth.uid()
    and exists (
      select 1
      from public.tournaments t
      where t.id = registrations.tournament_id
        and t.status in ('open', 'ongoing', 'in_progress')
    )
  )
);

drop policy if exists registrations_delete_policy on public.registrations;
create policy registrations_delete_policy
on public.registrations
for delete
to authenticated
using (
  public.is_tournament_admin(tournament_id)
  or (
    player_id = auth.uid()
    and exists (
      select 1
      from public.tournaments t
      where t.id = registrations.tournament_id
        and t.status in ('open', 'ongoing', 'in_progress')
    )
  )
);

-- -----------------------------------------------------------------------------
-- Function exposure hardening (reduce accidental RPC surface)
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.set_row_updated_at()') is not null then
    execute 'revoke all on function public.set_row_updated_at() from public';
  end if;

  if to_regprocedure('public.handle_new_auth_user_profile()') is not null then
    execute 'revoke all on function public.handle_new_auth_user_profile() from public';
  end if;

  if to_regprocedure('public.prevent_profile_privilege_escalation()') is not null then
    execute 'revoke all on function public.prevent_profile_privilege_escalation() from public';
  end if;

  if to_regprocedure('public.clear_push_token_when_disabled()') is not null then
    execute 'revoke all on function public.clear_push_token_when_disabled() from public';
  end if;

  if to_regprocedure('public.enforce_profile_insert_defaults()') is not null then
    execute 'revoke all on function public.enforce_profile_insert_defaults() from public';
  end if;

  if to_regprocedure('public.registrations_server_enforcer()') is not null then
    execute 'revoke all on function public.registrations_server_enforcer() from public';
  end if;

  if to_regprocedure('public.validate_match_winners()') is not null then
    execute 'revoke all on function public.validate_match_winners() from public';
  end if;

  if to_regprocedure('public.audit_payload(text,jsonb)') is not null then
    execute 'revoke all on function public.audit_payload(text,jsonb) from public';
  end if;

  if to_regprocedure('public.audit_log_changes()') is not null then
    execute 'revoke all on function public.audit_log_changes() from public';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Performance support for policy predicates
-- -----------------------------------------------------------------------------

create index if not exists tournaments_status_idx
  on public.tournaments(status);

create index if not exists registrations_tournament_player_status_idx
  on public.registrations(tournament_id, player_id, status);

commit;
