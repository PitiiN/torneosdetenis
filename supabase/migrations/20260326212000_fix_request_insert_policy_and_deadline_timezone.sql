begin;

create or replace function public.is_registration_deadline_open(
  tournament_id_input uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when deadline_value is null then true
      else timezone('America/Santiago', now())::timestamp <= deadline_value
    end
  from (
    select public.get_effective_registration_deadline(tournament_id_input) as deadline_value
  ) deadline_row;
$$;

revoke all on function public.is_registration_deadline_open(uuid) from public;
grant execute on function public.is_registration_deadline_open(uuid) to authenticated;

drop policy if exists tournament_registration_requests_insert_policy on public.tournament_registration_requests;
create policy tournament_registration_requests_insert_policy
on public.tournament_registration_requests
for insert
to authenticated
with check (
  auth.uid() is not null
  and coalesce(player_id, auth.uid()) = auth.uid()
  and public.is_tournament_registration_open_for_requests(tournament_id)
);

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
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
      and coalesce((metadata ->> 'size')::bigint, 0) <= 7340032
      and exists (
        select 1
        from public.tournaments t
        where t.id::text = (storage.foldername(name))[3]
          and t.organization_id::text = (storage.foldername(name))[2]
          and not coalesce(t.is_tournament_master, false)
      )
    )
  $sql$;
exception
  when insufficient_privilege then
    raise notice 'Skipping payment proof insert policy update due to insufficient privilege.';
end;
$$;

commit;
