begin;

do $$
begin
  if to_regclass('public.tournaments') is null then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_registration_close_after_start_chk'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      drop constraint tournaments_registration_close_after_start_chk;
  end if;

  alter table public.tournaments
    add constraint tournaments_registration_close_after_start_chk
    check (
      registration_close_at is null
      or start_date is null
      or registration_close_at <= start_date::date
    )
    not valid;
exception
  when duplicate_object then
    null;
end;
$$;

do $$
begin
  if to_regclass('public.tournament_registration_requests') is null then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'tournament_registration_requests_proof_path_chk'
      and conrelid = 'public.tournament_registration_requests'::regclass
  ) then
    alter table public.tournament_registration_requests
      drop constraint tournament_registration_requests_proof_path_chk;
  end if;

  alter table public.tournament_registration_requests
    add constraint tournament_registration_requests_proof_path_chk
    check (
      length(proof_path) between 10 and 500
      and proof_path not like '%..%'
      and proof_path ~* '^payment-proofs/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+/[A-Za-z0-9._-]+[.](jpg|jpeg|png|webp|heic|heif)$'
    )
    not valid;
exception
  when duplicate_object then
    null;
end;
$$;

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
      player_id_input::text || '/[A-Za-z0-9._-]+[.](jpg|jpeg|png|webp|heic|heif)$'
    );
$$;

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
          and (t.registration_close_at is null or current_date <= t.registration_close_at)
      )
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping payment proof insert policy update due to insufficient privilege.';
end;
$$;

commit;

