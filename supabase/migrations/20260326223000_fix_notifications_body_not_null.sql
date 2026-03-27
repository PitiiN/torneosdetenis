begin;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_tournament_id uuid default null,
  p_match_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    tournament_id,
    match_id
  )
  values (
    p_user_id,
    p_type,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Notificación'),
    coalesce(nullif(trim(coalesce(p_body, '')), ''), 'Tienes una nueva actualización.'),
    p_tournament_id,
    p_match_id
  );
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, uuid, uuid) from public;
grant execute on function public.create_notification(uuid, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.create_notification(uuid, text, text, text, uuid, uuid) to service_role;

commit;

