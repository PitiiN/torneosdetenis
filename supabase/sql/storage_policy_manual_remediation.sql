-- Storage policy manual remediation (third pass)
-- Purpose: ensure organizations bucket and storage.objects policies are fully applied.
-- Safe to run in Supabase SQL Editor (staging first).

begin;

-- -----------------------------------------------------------------------------
-- Execution-role guard
-- -----------------------------------------------------------------------------
do $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'Run this script with SQL Editor role = postgres (not %).', current_user;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Preconditions: required helper functions from previous migrations
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.current_user_is_super_admin()') is null then
    raise exception 'Missing dependency: public.current_user_is_super_admin()';
  end if;

  if to_regprocedure('public.is_org_admin(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_admin(uuid)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bucket hardening
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('organizations', 'organizations', false)
on conflict (id) do update
set public = excluded.public;

-- Some projects do not allow postgres to ALTER storage.objects ownership-level settings.
-- RLS is usually already enabled; do not fail remediation if this ALTER is blocked.
do $$
begin
  execute 'alter table storage.objects enable row level security';
exception
  when insufficient_privilege then
    raise notice 'Skipping ALTER TABLE storage.objects ENABLE RLS (insufficient privilege).';
end;
$$;

-- -----------------------------------------------------------------------------
-- Policy reset (idempotent)
-- -----------------------------------------------------------------------------
drop policy if exists organizations_assets_select on storage.objects;
drop policy if exists organizations_assets_select_logos on storage.objects;
drop policy if exists organizations_assets_select_avatars on storage.objects;
drop policy if exists organizations_assets_insert_avatars on storage.objects;
drop policy if exists organizations_assets_insert_logos on storage.objects;
drop policy if exists organizations_assets_update_avatars on storage.objects;
drop policy if exists organizations_assets_update_logos on storage.objects;
drop policy if exists organizations_assets_delete_avatars on storage.objects;
drop policy if exists organizations_assets_delete_logos on storage.objects;

-- -----------------------------------------------------------------------------
-- Read policies
-- -----------------------------------------------------------------------------
create policy organizations_assets_select_logos
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organizations'
  and (storage.foldername(name))[1] = 'logos'
);

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

-- -----------------------------------------------------------------------------
-- Insert policies
-- -----------------------------------------------------------------------------
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
);

-- -----------------------------------------------------------------------------
-- Update policies
-- -----------------------------------------------------------------------------
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
);

-- -----------------------------------------------------------------------------
-- Delete policies
-- -----------------------------------------------------------------------------
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

commit;
