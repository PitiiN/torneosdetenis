begin;

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

drop policy if exists organizations_assets_select_payment_proofs on storage.objects;
create policy organizations_assets_select_payment_proofs
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organizations'
  and public.can_manage_payment_proof_object(name)
);

drop policy if exists organizations_assets_delete_payment_proofs on storage.objects;
create policy organizations_assets_delete_payment_proofs
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organizations'
  and public.can_manage_payment_proof_object(name)
);

commit;

