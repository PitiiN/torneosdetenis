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
      )
  );
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (
      role is null
      or role = any (array['player', 'organizer', 'admin', 'referee', 'super_admin'])
    );
end;
$$;

do $$
declare
  v_super_admin_email constant text := 'javier.aravena25@gmail.com';
begin
  update public.profiles p
  set
    is_super_admin = lower(coalesce(u.email, '')) = v_super_admin_email,
    role = case
      when lower(coalesce(u.email, '')) = v_super_admin_email then 'super_admin'
      when p.role = 'super_admin' and p.org_id is not null then 'admin'
      when p.role = 'super_admin' then 'player'
      else p.role
    end,
    updated_at = now()
  from auth.users u
  where u.id = p.id
    and (
      coalesce(p.is_super_admin, false) is distinct from (lower(coalesce(u.email, '')) = v_super_admin_email)
      or (
        lower(coalesce(u.email, '')) = v_super_admin_email
        and p.role is distinct from 'super_admin'
      )
      or (
        lower(coalesce(u.email, '')) <> v_super_admin_email
        and p.role = 'super_admin'
      )
    );
end;
$$;
