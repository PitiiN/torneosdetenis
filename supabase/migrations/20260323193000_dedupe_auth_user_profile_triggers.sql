begin;

do $$
declare
  trigger_row record;
begin
  if to_regclass('auth.users') is null then
    return;
  end if;

  for trigger_row in
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace ns on ns.oid = p.pronamespace
    where c.oid = 'auth.users'::regclass
      and not t.tgisinternal
      and ns.nspname = 'public'
      and (
        p.proname in ('handle_new_user', 'handle_new_auth_user_profile')
        or pg_get_functiondef(p.oid) ilike '%insert into public.profiles%'
      )
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_row.tgname);
  end loop;
end;
$$;

drop function if exists public.handle_new_user();

create trigger trg_auth_user_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

commit;
