create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount >= 0),
  currency text not null default 'clp' check (lower(currency) = 'clp'),
  method text not null default 'bank_transfer' check (method = 'bank_transfer'),
  reference text not null check (char_length(reference) >= 3),
  storage_path text not null,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'APPROVED', 'REJECTED', 'NEEDS_INFO')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_proofs_registration_id on public.payment_proofs(registration_id);
create index if not exists idx_payment_proofs_user_id on public.payment_proofs(user_id);
create index if not exists idx_payment_proofs_status on public.payment_proofs(status);
create index if not exists idx_payment_proofs_created_at on public.payment_proofs(created_at desc);

alter table public.payment_proofs enable row level security;

drop policy if exists payment_proofs_select_self_or_admin_organizer on public.payment_proofs;
create policy payment_proofs_select_self_or_admin_organizer
on public.payment_proofs
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin_or_organizer(auth.uid())
);

drop policy if exists payment_proofs_insert_player_self on public.payment_proofs;
create policy payment_proofs_insert_player_self
on public.payment_proofs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_player(auth.uid())
  and status = 'SUBMITTED'
  and reviewed_by is null
  and reviewed_at is null
  and method = 'bank_transfer'
);

drop policy if exists payment_proofs_update_admin_organizer on public.payment_proofs;
create policy payment_proofs_update_admin_organizer
on public.payment_proofs
for update
to authenticated
using (public.is_admin_or_organizer(auth.uid()))
with check (public.is_admin_or_organizer(auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_proofs_bucket_insert_own on storage.objects;
create policy payment_proofs_bucket_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists payment_proofs_bucket_select_access on storage.objects;
create policy payment_proofs_bucket_select_access
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_admin_or_organizer(auth.uid())
  )
);

create or replace function public.review_payment_proof(
  p_proof_id uuid,
  p_status text,
  p_notes text default null
)
returns public.payment_proofs
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.review_payment_proof(uuid, text, text) to authenticated;
