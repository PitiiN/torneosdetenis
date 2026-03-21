-- Migration: 002_rls.sql
-- Description: Row Level Security policies for all tables
-- Created: 2026-02-05

-- Helper function to check if user is admin
create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = 'ADMIN'
  );
$$;

-- =====================
-- PROFILES TABLE RLS
-- =====================
alter table public.profiles enable row level security;

-- Users can read their own profile; admins can read all
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid() or public.is_admin(auth.uid()));

-- Users can update their own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Users can insert their own profile
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

-- =====================
-- USER ROLES TABLE RLS
-- =====================
alter table public.user_roles enable row level security;

-- Only admins can manage roles
drop policy if exists "roles_admin_all" on public.user_roles;
create policy "roles_admin_all"
on public.user_roles for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Users can read their own role
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own"
on public.user_roles for select
using (user_id = auth.uid());

-- =====================
-- FIELDS TABLE RLS
-- =====================
alter table public.fields enable row level security;

-- All authenticated users can read fields
drop policy if exists "fields_select_all" on public.fields;
create policy "fields_select_all"
on public.fields for select
using (auth.uid() is not null);

-- Only admins can write fields
drop policy if exists "fields_admin_write" on public.fields;
create policy "fields_admin_write"
on public.fields for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- =====================
-- FIELD SCHEDULES TABLE RLS
-- =====================
alter table public.field_schedules enable row level security;

-- All authenticated users can read schedules
drop policy if exists "schedules_select_all" on public.field_schedules;
create policy "schedules_select_all"
on public.field_schedules for select
using (auth.uid() is not null);

-- Only admins can write schedules
drop policy if exists "schedules_admin_write" on public.field_schedules;
create policy "schedules_admin_write"
on public.field_schedules for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- =====================
-- BOOKINGS TABLE RLS
-- =====================
alter table public.bookings enable row level security;

-- Users can see their own bookings; admins can see all
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
create policy "bookings_select_own_or_admin"
on public.bookings for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Users can create bookings for themselves (only in allowed initial statuses)
drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
on public.bookings for insert
with check (
  user_id = auth.uid()
  and status in ('PENDIENTE_PAGO', 'EN_VERIFICACION')
);

-- Users can update their own bookings (except PAGADA/BLOQUEADA)
drop policy if exists "bookings_update_own_limited" on public.bookings;
create policy "bookings_update_own_limited"
on public.bookings for update
using (user_id = auth.uid() and status not in ('PAGADA', 'BLOQUEADA'))
with check (user_id = auth.uid() and status not in ('PAGADA', 'BLOQUEADA'));

-- Admins can update all bookings
drop policy if exists "bookings_admin_update_all" on public.bookings;
create policy "bookings_admin_update_all"
on public.bookings for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Users can delete their own bookings (except PAGADA/BLOQUEADA)
drop policy if exists "bookings_delete_own_limited" on public.bookings;
create policy "bookings_delete_own_limited"
on public.bookings for delete
using (
  user_id = auth.uid()
  and status not in ('PAGADA', 'BLOQUEADA')
);

-- =====================
-- FIELD BLOCKS TABLE RLS
-- =====================
alter table public.field_blocks enable row level security;

-- All authenticated users can read blocks (to see unavailable slots)
drop policy if exists "blocks_select_all" on public.field_blocks;
create policy "blocks_select_all"
on public.field_blocks for select
using (auth.uid() is not null);

-- Only admins can manage blocks
drop policy if exists "blocks_admin_write" on public.field_blocks;
create policy "blocks_admin_write"
on public.field_blocks for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
