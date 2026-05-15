begin;

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
    and exists (
      select 1
      from public.tournaments parent_tournament
      where parent_tournament.id = tournaments.parent_tournament_id
        and parent_tournament.status in ('open', 'ongoing', 'in_progress', 'finished', 'completed', 'finalized')
    )
  )
);

do $$
begin
  execute 'drop policy if exists organizations_assets_insert_logos on storage.objects';
  execute 'drop policy if exists organizations_assets_update_logos on storage.objects';

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
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
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
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping logo storage policy changes due to insufficient privilege.';
end;
$$;

commit;
