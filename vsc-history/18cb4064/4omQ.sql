create table if not exists public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_outbox_user_id on public.notifications_outbox(user_id, created_at desc);
create index if not exists idx_notifications_outbox_status on public.notifications_outbox(status);

alter table public.notifications_outbox enable row level security;

drop policy if exists notifications_outbox_select on public.notifications_outbox;
create policy notifications_outbox_select
on public.notifications_outbox
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin_or_organizer(auth.uid())
);

drop policy if exists notifications_outbox_insert_admin_organizer on public.notifications_outbox;
create policy notifications_outbox_insert_admin_organizer
on public.notifications_outbox
for insert
to authenticated
with check (public.is_admin_or_organizer(auth.uid()));

create or replace function public.enqueue_schedule_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = new.match_id;
  if v_match.player1_id is not null then
    insert into public.notifications_outbox (user_id, type, payload, status)
    values (
      v_match.player1_id,
      'SCHEDULE_UPDATED',
      jsonb_build_object('schedule_id', new.id, 'match_id', new.match_id, 'court_id', new.court_id, 'start_at', new.start_at, 'status', new.status),
      'PENDING'
    );
  end if;
  if v_match.player2_id is not null then
    insert into public.notifications_outbox (user_id, type, payload, status)
    values (
      v_match.player2_id,
      'SCHEDULE_UPDATED',
      jsonb_build_object('schedule_id', new.id, 'match_id', new.match_id, 'court_id', new.court_id, 'start_at', new.start_at, 'status', new.status),
      'PENDING'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_notification on public.schedules;
create trigger trg_schedule_notification
after insert or update on public.schedules
for each row execute function public.enqueue_schedule_notification();

create or replace function public.enqueue_payment_approved_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'APPROVED' and (old.status is distinct from new.status) then
    insert into public.notifications_outbox (user_id, type, payload, status)
    values (
      new.user_id,
      'PAYMENT_APPROVED',
      jsonb_build_object('payment_proof_id', new.id, 'registration_id', new.registration_id, 'amount', new.amount, 'currency', new.currency),
      'PENDING'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_approved_notification on public.payment_proofs;
create trigger trg_payment_approved_notification
after update on public.payment_proofs
for each row execute function public.enqueue_payment_approved_notification();
