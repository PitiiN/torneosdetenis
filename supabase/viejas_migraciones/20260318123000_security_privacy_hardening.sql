-- Security and privacy hardening baseline for TorneosDeTenis
-- This migration is intentionally idempotent where possible.

begin;

create extension if not exists pgcrypto;
create schema if not exists app_private;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'organizations', 'tournaments', 'registrations', 'matches'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()', table_name);
      execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', table_name);
      execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
      execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_row_updated_at()', table_name, table_name);
    end if;
  end loop;
end;
$$;

alter table if exists public.profiles
  add column if not exists role text,
  add column if not exists org_id uuid,
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists notifications_enabled boolean not null default false,
  add column if not exists expo_push_token text;

alter table if exists public.registrations
  add column if not exists status text,
  add column if not exists fee_amount numeric(12,2) not null default 0,
  add column if not exists is_paid boolean not null default false,
  add column if not exists registered_at timestamptz not null default now();

alter table if exists public.tournaments
  add column if not exists status text,
  add column if not exists registration_fee numeric(12,2) not null default 0;

alter table if exists public.matches
  add column if not exists status text,
  add column if not exists score text,
  add column if not exists round text,
  add column if not exists round_number integer,
  add column if not exists match_order integer,
  add column if not exists scheduled_at timestamptz,
  add column if not exists court text,
  add column if not exists player_a2_id uuid,
  add column if not exists player_b2_id uuid,
  add column if not exists winner_2_id uuid;

do $$
begin
  if to_regclass('public.profiles') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_allowed_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_allowed_chk
      check (role is null or role in ('player', 'organizer', 'admin', 'super_admin'))
      not valid;
  end if;

  if to_regclass('public.tournaments') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_status_allowed_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_status_allowed_chk
      check (status is null or status in ('draft', 'open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized', 'cancelled'))
      not valid;
  end if;

  if to_regclass('public.tournaments') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_registration_fee_non_negative_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_registration_fee_non_negative_chk
      check (coalesce(registration_fee, 0) >= 0)
      not valid;
  end if;

  if to_regclass('public.tournaments') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_max_players_positive_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_max_players_positive_chk
      check (max_players is null or max_players between 2 and 256)
      not valid;
  end if;

  if to_regclass('public.registrations') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'registrations_status_allowed_chk'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_status_allowed_chk
      check (status is null or status in ('pending', 'confirmed', 'cancelled', 'rejected'))
      not valid;
  end if;

  if to_regclass('public.registrations') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'registrations_fee_non_negative_chk'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_fee_non_negative_chk
      check (coalesce(fee_amount, 0) >= 0)
      not valid;
  end if;

  if to_regclass('public.matches') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'matches_status_allowed_chk'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_status_allowed_chk
      check (status is null or status in ('pending', 'scheduled', 'live', 'finished', 'cancelled', 'walkover'))
      not valid;
  end if;

  if to_regclass('public.matches') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'matches_winner_player_chk'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_winner_player_chk
      check (
        winner_id is null
        or winner_id = player_a_id
        or winner_id = player_b_id
      )
      not valid;
  end if;

  if to_regclass('public.matches') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'matches_winner_partner_chk'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_winner_partner_chk
      check (
        winner_2_id is null
        or winner_2_id = player_a2_id
        or winner_2_id = player_b2_id
      )
      not valid;
  end if;

  if to_regclass('public.matches') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'matches_round_number_positive_chk'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_round_number_positive_chk
      check (round_number is null or round_number >= 1)
      not valid;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.profiles') is not null
     and to_regclass('public.organizations') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'profiles_org_id_fk_hardened'
         and conrelid = 'public.profiles'::regclass
     ) then
    alter table public.profiles
      add constraint profiles_org_id_fk_hardened
      foreign key (org_id) references public.organizations(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.tournaments') is not null
     and to_regclass('public.organizations') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'tournaments_org_id_fk_hardened'
         and conrelid = 'public.tournaments'::regclass
     ) then
    alter table public.tournaments
      add constraint tournaments_org_id_fk_hardened
      foreign key (organization_id) references public.organizations(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.registrations') is not null
     and to_regclass('public.tournaments') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'registrations_tournament_fk_hardened'
         and conrelid = 'public.registrations'::regclass
     ) then
    alter table public.registrations
      add constraint registrations_tournament_fk_hardened
      foreign key (tournament_id) references public.tournaments(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.registrations') is not null
     and to_regclass('public.profiles') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'registrations_player_fk_hardened'
         and conrelid = 'public.registrations'::regclass
     ) then
    alter table public.registrations
      add constraint registrations_player_fk_hardened
      foreign key (player_id) references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.matches') is not null
     and to_regclass('public.tournaments') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'matches_tournament_fk_hardened'
         and conrelid = 'public.matches'::regclass
     ) then
    alter table public.matches
      add constraint matches_tournament_fk_hardened
      foreign key (tournament_id) references public.tournaments(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.matches') is not null
     and to_regclass('public.profiles') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'matches_player_a_fk_hardened'
         and conrelid = 'public.matches'::regclass
     ) then
    alter table public.matches
      add constraint matches_player_a_fk_hardened
      foreign key (player_a_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.matches') is not null
     and to_regclass('public.profiles') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'matches_player_b_fk_hardened'
         and conrelid = 'public.matches'::regclass
     ) then
    alter table public.matches
      add constraint matches_player_b_fk_hardened
      foreign key (player_b_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.matches') is not null
     and to_regclass('public.profiles') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'matches_player_a2_fk_hardened'
         and conrelid = 'public.matches'::regclass
     ) then
    alter table public.matches
      add constraint matches_player_a2_fk_hardened
      foreign key (player_a2_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.matches') is not null
     and to_regclass('public.profiles') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'matches_player_b2_fk_hardened'
         and conrelid = 'public.matches'::regclass
     ) then
    alter table public.matches
      add constraint matches_player_b2_fk_hardened
      foreign key (player_b2_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;
end;
$$;

create unique index if not exists registrations_tournament_player_uidx
  on public.registrations(tournament_id, player_id);

create index if not exists tournaments_org_status_start_idx
  on public.tournaments(organization_id, status, start_date);

create index if not exists registrations_player_idx
  on public.registrations(player_id);

create index if not exists registrations_tournament_idx
  on public.registrations(tournament_id);

create index if not exists matches_tournament_round_idx
  on public.matches(tournament_id, round_number, match_order);

create index if not exists matches_player_a_idx
  on public.matches(player_a_id);

create index if not exists matches_player_b_idx
  on public.matches(player_b_id);

create index if not exists profiles_org_role_idx
  on public.profiles(org_id, role);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.is_org_admin(org_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.is_tournament_admin(tournament_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id_input
      and public.is_org_admin(t.organization_id)
  );
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_org_id() from public;
revoke all on function public.current_user_is_super_admin() from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.is_tournament_admin(uuid) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_org_id() to authenticated;
grant execute on function public.current_user_is_super_admin() to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_tournament_admin(uuid) to authenticated;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    role,
    is_super_admin,
    notifications_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    'player',
    false,
    false,
    now(),
    now()
  )
  on conflict (id) do update
    set updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_profile on auth.users;
create trigger trg_auth_user_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.clear_push_token_when_disabled()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.notifications_enabled, false) = false then
    new.expo_push_token := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_privilege_escalation on public.profiles;
create trigger trg_profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

drop trigger if exists trg_profiles_clear_push_token on public.profiles;
create trigger trg_profiles_clear_push_token
before insert or update on public.profiles
for each row execute function public.clear_push_token_when_disabled();

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

    new.fee_amount := tournament_fee;
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
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registrations_server_enforcer on public.registrations;
create trigger trg_registrations_server_enforcer
before insert or update on public.registrations
for each row execute function public.registrations_server_enforcer();

create or replace function public.validate_match_winners()
returns trigger
language plpgsql
as $$
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

drop trigger if exists trg_matches_validate_winners on public.matches;
create trigger trg_matches_validate_winners
before insert or update on public.matches
for each row execute function public.validate_match_winners();

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'organizations', 'tournaments', 'registrations', 'matches')
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$$;

alter table if exists public.profiles enable row level security;
alter table if exists public.organizations enable row level security;
alter table if exists public.tournaments enable row level security;
alter table if exists public.registrations enable row level security;
alter table if exists public.matches enable row level security;

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
  or exists (
    select 1
    from public.registrations r_me
    join public.registrations r_other on r_me.tournament_id = r_other.tournament_id
    where r_me.player_id = auth.uid()
      and r_other.player_id = profiles.id
  )
);

create policy profiles_insert_policy
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  or public.current_user_is_super_admin()
);

create policy profiles_update_policy
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_super_admin()
)
with check (
  id = auth.uid()
  or public.current_user_is_super_admin()
);

create policy profiles_delete_policy
on public.profiles
for delete
to authenticated
using (public.current_user_is_super_admin());

create policy organizations_select_policy
on public.organizations
for select
to authenticated
using (true);

create policy organizations_insert_policy
on public.organizations
for insert
to authenticated
with check (public.current_user_is_super_admin());

create policy organizations_update_policy
on public.organizations
for update
to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy organizations_delete_policy
on public.organizations
for delete
to authenticated
using (public.current_user_is_super_admin());

create policy tournaments_select_policy
on public.tournaments
for select
to authenticated
using (
  status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
  or public.is_tournament_admin(id)
  or exists (
    select 1
    from public.registrations r
    where r.tournament_id = tournaments.id
      and r.player_id = auth.uid()
  )
);

create policy tournaments_insert_policy
on public.tournaments
for insert
to authenticated
with check (public.is_org_admin(organization_id));

create policy tournaments_update_policy
on public.tournaments
for update
to authenticated
using (public.is_tournament_admin(id))
with check (public.is_tournament_admin(id));

create policy tournaments_delete_policy
on public.tournaments
for delete
to authenticated
using (public.is_tournament_admin(id));

create policy registrations_select_policy
on public.registrations
for select
to authenticated
using (
  player_id = auth.uid()
  or public.is_tournament_admin(tournament_id)
);

create policy registrations_insert_policy
on public.registrations
for insert
to authenticated
with check (
  (coalesce(player_id, auth.uid()) = auth.uid()
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and t.status in ('open', 'ongoing', 'in_progress')
    ))
  or public.is_tournament_admin(tournament_id)
);

create policy registrations_update_policy
on public.registrations
for update
to authenticated
using (
  player_id = auth.uid()
  or public.is_tournament_admin(tournament_id)
)
with check (
  player_id = auth.uid()
  or public.is_tournament_admin(tournament_id)
);

create policy registrations_delete_policy
on public.registrations
for delete
to authenticated
using (
  player_id = auth.uid()
  or public.is_tournament_admin(tournament_id)
);

create policy matches_select_policy
on public.matches
for select
to authenticated
using (
  public.is_tournament_admin(tournament_id)
  or exists (
    select 1
    from public.tournaments t
    where t.id = matches.tournament_id
      and t.status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
  )
  or exists (
    select 1
    from public.registrations r
    where r.tournament_id = matches.tournament_id
      and r.player_id = auth.uid()
  )
);

create policy matches_insert_policy
on public.matches
for insert
to authenticated
with check (public.is_tournament_admin(tournament_id));

create policy matches_update_policy
on public.matches
for update
to authenticated
using (public.is_tournament_admin(tournament_id))
with check (public.is_tournament_admin(tournament_id));

create policy matches_delete_policy
on public.matches
for delete
to authenticated
using (public.is_tournament_admin(tournament_id));

insert into storage.buckets (id, name, public)
values ('organizations', 'organizations', false)
on conflict (id) do update
set public = excluded.public;

-- NOTE:
-- In some hosted environments this statement can fail with:
-- "must be owner of table objects" (SQLSTATE 42501).
-- storage.objects usually already has RLS enabled by Supabase.
-- Keep migration idempotent by swallowing only privilege errors.
do $$
begin
  execute 'alter table storage.objects enable row level security';
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER TABLE storage.objects ENABLE RLS due to insufficient privilege.';
end;
$$;

do $$
begin
  execute 'drop policy if exists organizations_assets_select on storage.objects';
  execute 'drop policy if exists organizations_assets_select_logos on storage.objects';
  execute 'drop policy if exists organizations_assets_select_avatars on storage.objects';
  execute 'drop policy if exists organizations_assets_insert_avatars on storage.objects';
  execute 'drop policy if exists organizations_assets_insert_logos on storage.objects';
  execute 'drop policy if exists organizations_assets_update_avatars on storage.objects';
  execute 'drop policy if exists organizations_assets_update_logos on storage.objects';
  execute 'drop policy if exists organizations_assets_delete_avatars on storage.objects';
  execute 'drop policy if exists organizations_assets_delete_logos on storage.objects';

  execute $sql$
    create policy organizations_assets_select_logos
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'logos'
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_select_avatars
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'avatars'
      and (
        (storage.foldername(name))[2] = auth.uid()::text
        or public.current_user_is_super_admin()
      )
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_insert_avatars
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_insert_logos
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'logos'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.is_org_admin(((storage.foldername(name))[2])::uuid)
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_update_avatars
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    with check (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_update_logos
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'logos'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.is_org_admin(((storage.foldername(name))[2])::uuid)
    )
    with check (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'logos'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.is_org_admin(((storage.foldername(name))[2])::uuid)
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_delete_avatars
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'avatars'
      and (
        (storage.foldername(name))[2] = auth.uid()::text
        or public.current_user_is_super_admin()
      )
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_delete_logos
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'logos'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.is_org_admin(((storage.foldername(name))[2])::uuid)
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects policy changes due to insufficient privilege.';
end;
$$;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text null,
  old_data jsonb null,
  new_data jsonb null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_table, entity_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_super_admin on public.audit_logs;
create policy audit_logs_select_super_admin
on public.audit_logs
for select
to authenticated
using (public.current_user_is_super_admin());

create or replace function public.audit_payload(table_name_input text, row_data jsonb)
returns jsonb
language sql
immutable
as $$
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

create or replace function public.audit_log_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  old_payload jsonb;
  new_payload jsonb;
begin
  actor_id := auth.uid();
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

drop trigger if exists trg_audit_profiles on public.profiles;
drop trigger if exists trg_audit_tournaments on public.tournaments;
drop trigger if exists trg_audit_registrations on public.registrations;
drop trigger if exists trg_audit_matches on public.matches;

create trigger trg_audit_profiles
after insert or update or delete on public.profiles
for each row execute function public.audit_log_changes();

create trigger trg_audit_tournaments
after insert or update or delete on public.tournaments
for each row execute function public.audit_log_changes();

create trigger trg_audit_registrations
after insert or update or delete on public.registrations
for each row execute function public.audit_log_changes();

create trigger trg_audit_matches
after insert or update or delete on public.matches
for each row execute function public.audit_log_changes();

create or replace function public.purge_expired_audit_logs(retention_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.audit_logs
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_audit_logs(integer) from public;
grant execute on function public.purge_expired_audit_logs(integer) to service_role;

commit;
