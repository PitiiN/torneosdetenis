-- =============================================================================
-- DEV STORAGE SETUP
-- Run this in the Supabase SQL Editor for the DEV project (mdmufdigkfsqcahfvqdz)
-- This creates the 'organizations' bucket and all necessary RLS policies.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Create bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('organizations', 'organizations', false)
on conflict (id) do update
set public = excluded.public;

-- Enable RLS on storage.objects (usually already enabled)
do $$
begin
  execute 'alter table storage.objects enable row level security';
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER TABLE storage.objects ENABLE RLS (insufficient privilege).';
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Drop all existing policies (idempotent)
-- -----------------------------------------------------------------------------
drop policy if exists organizations_assets_select on storage.objects;
drop policy if exists organizations_assets_select_logos on storage.objects;
drop policy if exists organizations_assets_select_avatars on storage.objects;
drop policy if exists organizations_assets_select_posters on storage.objects;
drop policy if exists organizations_assets_select_payment_proofs on storage.objects;
drop policy if exists organizations_assets_insert_avatars on storage.objects;
drop policy if exists organizations_assets_insert_logos on storage.objects;
drop policy if exists organizations_assets_insert_posters on storage.objects;
drop policy if exists organizations_assets_insert_payment_proofs on storage.objects;
drop policy if exists organizations_assets_update_avatars on storage.objects;
drop policy if exists organizations_assets_update_logos on storage.objects;
drop policy if exists organizations_assets_update_posters on storage.objects;
drop policy if exists organizations_assets_delete_avatars on storage.objects;
drop policy if exists organizations_assets_delete_logos on storage.objects;
drop policy if exists organizations_assets_delete_posters on storage.objects;
drop policy if exists organizations_assets_delete_payment_proofs on storage.objects;

-- -----------------------------------------------------------------------------
-- 3. Helper functions (if they don't already exist)
-- -----------------------------------------------------------------------------

-- can_upload_payment_proof_object
create or replace function public.can_upload_payment_proof_object(
  object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.can_upload_payment_proof_object(text) from public;
grant execute on function public.can_upload_payment_proof_object(text) to authenticated;

-- can_manage_payment_proof_object (for admin select/delete)
create or replace function public.can_manage_payment_proof_object(
  object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.can_manage_payment_proof_object(text) from public;
grant execute on function public.can_manage_payment_proof_object(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. AVATARS policies (users can manage their own avatar)
-- -----------------------------------------------------------------------------
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
);

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
);

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
);

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
);

-- -----------------------------------------------------------------------------
-- 5. LOGOS policies (org admins can manage logos)
-- -----------------------------------------------------------------------------
create policy organizations_assets_select_logos
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'logos'
);

create policy organizations_assets_insert_logos
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'logos'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
  and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
);

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
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
  and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
);

create policy organizations_assets_delete_logos
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'logos'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
);

-- -----------------------------------------------------------------------------
-- 6. POSTERS policies (org admins can manage tournament posters)
--    Path: posters/{org_id}/{tournament_id}/{filename}
-- -----------------------------------------------------------------------------
create policy organizations_assets_select_posters
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'posters'
);

create policy organizations_assets_insert_posters
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'posters'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
  and coalesce((metadata ->> 'size')::bigint, 0) <= 10485760
);

create policy organizations_assets_update_posters
on storage.objects
for update
to authenticated
using (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'posters'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'posters'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
  and coalesce((metadata ->> 'size')::bigint, 0) <= 10485760
);

create policy organizations_assets_delete_posters
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'posters'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
);

-- -----------------------------------------------------------------------------
-- 7. PAYMENT PROOFS policies
-- -----------------------------------------------------------------------------
create policy organizations_assets_insert_payment_proofs
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organizations'
  and public.can_upload_payment_proof_object(name)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and coalesce((metadata ->> 'size')::bigint, 0) <= 7340032
);

create policy organizations_assets_select_payment_proofs
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organizations'
  and public.can_manage_payment_proof_object(name)
);

create policy organizations_assets_delete_payment_proofs
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organizations'
  and public.can_manage_payment_proof_object(name)
);

commit;
