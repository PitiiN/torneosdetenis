begin;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  candidate_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  candidate_name := nullif(
    trim(
      coalesce(
        meta->>'name',
        meta->>'full_name',
        meta->>'display_name',
        concat_ws(' ', meta->>'first_name', meta->>'last_name')
      )
    ),
    ''
  );

  if candidate_name is null then
    candidate_name := 'Jugador';
  end if;

  insert into public.profiles (
    id,
    name,
    role,
    is_super_admin,
    notifications_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    left(candidate_name, 80),
    'player',
    false,
    false,
    now(),
    now()
  )
  on conflict (id) do update
    set name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
        updated_at = excluded.updated_at;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.organizations') is null then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'organizations_contact_email_format_chk'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      drop constraint organizations_contact_email_format_chk;
  end if;

  alter table public.organizations
    add constraint organizations_contact_email_format_chk
    check (
      contact_email is null
      or (
        length(contact_email) <= 120
        and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      )
    )
    not valid;
end;
$$;

commit;
