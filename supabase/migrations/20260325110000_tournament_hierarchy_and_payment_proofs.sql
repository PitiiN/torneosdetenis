begin;

alter table if exists public.tournaments
  add column if not exists parent_tournament_id uuid,
  add column if not exists is_tournament_master boolean not null default false,
  add column if not exists registration_close_at date;

do $$
begin
  if to_regclass('public.tournaments') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_parent_tournament_fk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_parent_tournament_fk
      foreign key (parent_tournament_id) references public.tournaments(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_parent_not_self_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_parent_not_self_chk
      check (parent_tournament_id is null or parent_tournament_id <> id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_master_parent_null_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_master_parent_null_chk
      check (not is_tournament_master or parent_tournament_id is null)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_registration_close_after_start_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_registration_close_after_start_chk
      check (
        registration_close_at is null
        or start_date is null
        or registration_close_at >= start_date::date
      )
      not valid;
  end if;
end
$$;

create index if not exists tournaments_parent_tournament_idx
  on public.tournaments(parent_tournament_id);

create index if not exists tournaments_master_status_start_idx
  on public.tournaments(organization_id, is_tournament_master, status, start_date);

create table if not exists public.tournament_registration_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  proof_path text not null,
  status text not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_registration_id uuid references public.registrations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.tournament_registration_requests
  add column if not exists tournament_id uuid,
  add column if not exists organization_id uuid,
  add column if not exists player_id uuid,
  add column if not exists proof_path text,
  add column if not exists status text,
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_registration_id uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.tournament_registration_requests') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournament_registration_requests_status_chk'
      and conrelid = 'public.tournament_registration_requests'::regclass
  ) then
    alter table public.tournament_registration_requests
      add constraint tournament_registration_requests_status_chk
      check (status in ('pending', 'approved', 'rejected'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournament_registration_requests_proof_path_chk'
      and conrelid = 'public.tournament_registration_requests'::regclass
  ) then
    alter table public.tournament_registration_requests
      add constraint tournament_registration_requests_proof_path_chk
      check (
        length(proof_path) between 10 and 500
        and proof_path like 'payment-proofs/%'
        and proof_path not like '%..%'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournament_registration_requests_rejection_reason_chk'
      and conrelid = 'public.tournament_registration_requests'::regclass
  ) then
    alter table public.tournament_registration_requests
      add constraint tournament_registration_requests_rejection_reason_chk
      check (
        (status <> 'rejected' and rejection_reason is null)
        or (status = 'rejected' and length(trim(coalesce(rejection_reason, ''))) between 3 and 250)
      )
      not valid;
  end if;
end
$$;

create index if not exists tournament_registration_requests_tournament_status_idx
  on public.tournament_registration_requests(tournament_id, status, created_at desc);

create index if not exists tournament_registration_requests_player_status_idx
  on public.tournament_registration_requests(player_id, status, updated_at desc);

create unique index if not exists tournament_registration_requests_pending_uidx
  on public.tournament_registration_requests(tournament_id, player_id)
  where status = 'pending';

drop trigger if exists set_tournament_registration_requests_updated_at on public.tournament_registration_requests;
create trigger set_tournament_registration_requests_updated_at
before update on public.tournament_registration_requests
for each row execute function public.set_row_updated_at();

create or replace function public.is_valid_payment_proof_path(
  proof_path_input text,
  organization_id_input uuid,
  tournament_id_input uuid,
  player_id_input uuid
)
returns boolean
language sql
immutable
as $$
  select
    proof_path_input is not null
    and length(proof_path_input) between 10 and 500
    and proof_path_input not like '%..%'
    and proof_path_input ~* (
      '^payment-proofs/' ||
      organization_id_input::text || '/' ||
      tournament_id_input::text || '/' ||
      player_id_input::text || '/[A-Za-z0-9._-]+[.](jpg|jpeg|png|webp)$'
    );
$$;

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
begin
  if new.tournament_id is null then
    raise exception 'tournament_id is required';
  end if;

  select
    t.id,
    t.organization_id,
    t.status,
    t.registration_close_at,
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
       and tournament_record.registration_close_at is not null
       and current_date > tournament_record.registration_close_at then
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

drop trigger if exists trg_registration_requests_server_enforcer on public.tournament_registration_requests;
create trigger trg_registration_requests_server_enforcer
before insert or update on public.tournament_registration_requests
for each row execute function public.registration_requests_server_enforcer();

alter table if exists public.tournament_registration_requests enable row level security;

drop policy if exists tournament_registration_requests_select_policy on public.tournament_registration_requests;
create policy tournament_registration_requests_select_policy
on public.tournament_registration_requests
for select
to authenticated
using (
  player_id = auth.uid()
  or public.is_tournament_admin(tournament_id)
);

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
      and (t.registration_close_at is null or current_date <= t.registration_close_at)
  )
);

drop policy if exists tournament_registration_requests_update_policy on public.tournament_registration_requests;
create policy tournament_registration_requests_update_policy
on public.tournament_registration_requests
for update
to authenticated
using (public.is_tournament_admin(tournament_id))
with check (public.is_tournament_admin(tournament_id));

drop policy if exists tournament_registration_requests_delete_policy on public.tournament_registration_requests;
create policy tournament_registration_requests_delete_policy
on public.tournament_registration_requests
for delete
to authenticated
using (public.is_tournament_admin(tournament_id));

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

drop trigger if exists trg_registrations_server_enforcer on public.registrations;
create trigger trg_registrations_server_enforcer
before insert or update on public.registrations
for each row execute function public.registrations_server_enforcer();

drop policy if exists registrations_insert_policy on public.registrations;
create policy registrations_insert_policy
on public.registrations
for insert
to authenticated
with check (public.is_tournament_admin(tournament_id));

do $$
begin
  execute 'drop policy if exists organizations_assets_select_payment_proofs on storage.objects';
  execute 'drop policy if exists organizations_assets_insert_payment_proofs on storage.objects';
  execute 'drop policy if exists organizations_assets_delete_payment_proofs on storage.objects';

  execute $sql$
    create policy organizations_assets_select_payment_proofs
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'payment-proofs'
      and (
        (storage.foldername(name))[4] = auth.uid()::text
        or exists (
          select 1
          from public.tournaments t
          where t.id::text = (storage.foldername(name))[3]
            and t.organization_id::text = (storage.foldername(name))[2]
            and public.is_org_admin(t.organization_id)
        )
      )
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_insert_payment_proofs
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'payment-proofs'
      and (storage.foldername(name))[4] = auth.uid()::text
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 7340032
      and exists (
        select 1
        from public.tournaments t
        where t.id::text = (storage.foldername(name))[3]
          and t.organization_id::text = (storage.foldername(name))[2]
          and not coalesce(t.is_tournament_master, false)
          and t.status in ('open', 'ongoing', 'in_progress')
          and (t.registration_close_at is null or current_date <= t.registration_close_at)
      )
    )
  $sql$;

  execute $sql$
    create policy organizations_assets_delete_payment_proofs
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'organizations'
      and (storage.foldername(name))[1] = 'payment-proofs'
      and (
        (storage.foldername(name))[4] = auth.uid()::text
        or exists (
          select 1
          from public.tournaments t
          where t.id::text = (storage.foldername(name))[3]
            and t.organization_id::text = (storage.foldername(name))[2]
            and public.is_org_admin(t.organization_id)
        )
      )
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping payment proof storage policy changes due to insufficient privilege.';
end;
$$;

do $$
begin
  if to_regprocedure('public.audit_log_changes()') is not null then
    drop trigger if exists trg_audit_tournament_registration_requests on public.tournament_registration_requests;
    create trigger trg_audit_tournament_registration_requests
    after insert or update or delete on public.tournament_registration_requests
    for each row execute function public.audit_log_changes();
  end if;
end;
$$;

revoke all on function public.is_valid_payment_proof_path(text, uuid, uuid, uuid) from public;
revoke all on function public.registration_requests_server_enforcer() from public;
revoke all on function public.registrations_server_enforcer() from public;

commit;
