-- Fix audit logging when the acting user's profile is being deleted.
-- In self-service account deletion flows, the AFTER DELETE trigger on profiles
-- can run after the actor row is gone, so actor_user_id must be nullable here.

begin;

create or replace function public.audit_log_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  old_payload jsonb;
  new_payload jsonb;
begin
  actor_id := auth.uid();

  -- If the actor no longer has a profile row (for example, deleting their own
  -- account), keep the audit entry but drop the actor FK reference.
  if actor_id is not null
     and not exists (
       select 1
       from public.profiles
       where id = actor_id
     ) then
    actor_id := null;
  end if;

  old_payload := case when tg_op in ('UPDATE', 'DELETE') then public.audit_payload(tg_table_name, to_jsonb(old)) else null end;
  new_payload := case when tg_op in ('INSERT', 'UPDATE') then public.audit_payload(tg_table_name, to_jsonb(new)) else null end;

  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    if old_payload = new_payload then
      return new;
    end if;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    actor_id,
    tg_op,
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id::text else new.id::text end), null),
    old_payload,
    new_payload,
    jsonb_build_object(
      'source', 'db_trigger',
      'timestamp', now()
    )
  );

  return coalesce(new, old);
end;
$$;

commit;
