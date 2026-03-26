begin;

update public.tournaments child
set status = parent.status
from public.tournaments parent
where child.parent_tournament_id = parent.id
  and coalesce(parent.is_tournament_master, false) = true
  and child.status is distinct from parent.status;

commit;
