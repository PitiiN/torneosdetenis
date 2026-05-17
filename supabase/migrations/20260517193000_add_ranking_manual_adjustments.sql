create table if not exists public.ranking_manual_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  level text not null,
  modality text not null default 'singles',
  player_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_manual_adjustments_modality_check check (modality in ('singles', 'dobles')),
  constraint ranking_manual_adjustments_unique_context unique (organization_id, level, modality, player_id)
);

create index if not exists ranking_manual_adjustments_context_idx
  on public.ranking_manual_adjustments (organization_id, level, modality);

alter table public.ranking_manual_adjustments enable row level security;

drop policy if exists "ranking_manual_adjustments_select_authenticated" on public.ranking_manual_adjustments;
create policy "ranking_manual_adjustments_select_authenticated"
on public.ranking_manual_adjustments
for select
to authenticated
using (true);

drop policy if exists "ranking_manual_adjustments_insert_org_admin" on public.ranking_manual_adjustments;
create policy "ranking_manual_adjustments_insert_org_admin"
on public.ranking_manual_adjustments
for insert
to authenticated
with check (
  public.is_org_admin(organization_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "ranking_manual_adjustments_update_org_admin" on public.ranking_manual_adjustments;
create policy "ranking_manual_adjustments_update_org_admin"
on public.ranking_manual_adjustments
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (
  public.is_org_admin(organization_id)
  and updated_by = auth.uid()
);

drop policy if exists "ranking_manual_adjustments_delete_org_admin" on public.ranking_manual_adjustments;
create policy "ranking_manual_adjustments_delete_org_admin"
on public.ranking_manual_adjustments
for delete
to authenticated
using (public.is_org_admin(organization_id));

create or replace function public.set_ranking_manual_adjustment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ranking_manual_adjustments_set_updated_at on public.ranking_manual_adjustments;
create trigger ranking_manual_adjustments_set_updated_at
before update on public.ranking_manual_adjustments
for each row
execute function public.set_ranking_manual_adjustment_updated_at();

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type = any (
      array[
        'match_start'::text,
        'result'::text,
        'round_advance'::text,
        'info'::text,
        'registration'::text,
        'ranking_position_updated'::text,
        'ranking_category_updated'::text,
        'ranking_new_number_one'::text
      ]
    )
  );
