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
  has_name_column boolean;
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

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'name'
  ) into has_name_column;

  begin
    if has_name_column then
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
    else
      insert into public.profiles (
        id,
        role,
        is_super_admin,
        notifications_enabled,
        created_at,
        updated_at
      )
      values (
        new.id,
        'player',
        false,
        false,
        now(),
        now()
      )
      on conflict (id) do update
        set updated_at = excluded.updated_at;
    end if;
  exception
    when others then
      raise warning 'handle_new_auth_user_profile failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

commit;
