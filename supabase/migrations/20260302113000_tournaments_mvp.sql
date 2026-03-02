create extension if not exists pgcrypto;

create or replace function public.is_admin_or_organizer(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role in ('admin', 'organizer')
  );
$$;

create or replace function public.is_player(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role = 'player'
  );
$$;

grant execute on function public.is_admin_or_organizer(uuid) to authenticated;
grant execute on function public.is_player(uuid) to authenticated;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) >= 3),
  start_date date not null,
  end_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) >= 2),
  type text not null check (type in ('singles', 'doubles')),
  level text not null check (level in ('Cuarta', 'Tercera', 'Honor')),
  created_at timestamptz not null default now(),
  unique (tournament_id, name, type, level)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING_PAYMENT' check (status in ('PENDING_PAYMENT', 'ACTIVE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  unique (category_id, user_id)
);

create index if not exists idx_tournaments_status_start on public.tournaments(status, start_date);
create index if not exists idx_categories_tournament_id on public.categories(tournament_id);
create index if not exists idx_registrations_category_id on public.registrations(category_id);
create index if not exists idx_registrations_user_id on public.registrations(user_id);

alter table public.tournaments enable row level security;
alter table public.categories enable row level security;
alter table public.registrations enable row level security;

drop policy if exists tournaments_select_authenticated on public.tournaments;
create policy tournaments_select_authenticated
on public.tournaments
for select
to authenticated
using (true);

drop policy if exists tournaments_insert_admin_organizer on public.tournaments;
create policy tournaments_insert_admin_organizer
on public.tournaments
for insert
to authenticated
with check (
  public.is_admin_or_organizer(auth.uid())
  and created_by = auth.uid()
);

drop policy if exists tournaments_update_admin_organizer on public.tournaments;
create policy tournaments_update_admin_organizer
on public.tournaments
for update
to authenticated
using (public.is_admin_or_organizer(auth.uid()))
with check (public.is_admin_or_organizer(auth.uid()));

drop policy if exists tournaments_delete_admin_organizer on public.tournaments;
create policy tournaments_delete_admin_organizer
on public.tournaments
for delete
to authenticated
using (public.is_admin_or_organizer(auth.uid()));

drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated
on public.categories
for select
to authenticated
using (true);

drop policy if exists categories_insert_admin_organizer on public.categories;
create policy categories_insert_admin_organizer
on public.categories
for insert
to authenticated
with check (public.is_admin_or_organizer(auth.uid()));

drop policy if exists categories_update_admin_organizer on public.categories;
create policy categories_update_admin_organizer
on public.categories
for update
to authenticated
using (public.is_admin_or_organizer(auth.uid()))
with check (public.is_admin_or_organizer(auth.uid()));

drop policy if exists categories_delete_admin_organizer on public.categories;
create policy categories_delete_admin_organizer
on public.categories
for delete
to authenticated
using (public.is_admin_or_organizer(auth.uid()));

drop policy if exists registrations_select_self_or_admin_organizer on public.registrations;
create policy registrations_select_self_or_admin_organizer
on public.registrations
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin_or_organizer(auth.uid())
);

drop policy if exists registrations_insert_player_self on public.registrations;
create policy registrations_insert_player_self
on public.registrations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_player(auth.uid())
);
