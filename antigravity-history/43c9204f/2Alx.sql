-- Migration: 001_init.sql
-- Description: Initial schema setup for court rental application
-- Created: 2026-02-05

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Create enums for booking status and user roles
do $$ begin
  create type booking_status as enum (
    'PENDIENTE_PAGO',
    'EN_VERIFICACION',
    'PAGADA',
    'RECHAZADA',
    'CANCELADA',
    'BLOQUEADA',
    'EXPIRADA'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('USER', 'ADMIN');
exception when duplicate_object then null; end $$;

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_phone_idx on public.profiles(phone);

-- User roles table
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'USER',
  created_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles(role);

-- Fields table (canchas)
create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location_text text,
  timezone text not null default 'America/Santiago',
  slot_duration_minutes int not null default 60,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Insert default 3 courts
insert into public.fields (name, slot_duration_minutes, location_text) values
  ('CANCHA 1', 60, 'Sector Norte'),
  ('CANCHA 2', 60, 'Sector Central'),
  ('CANCHA 3', 60, 'Sector Sur')
on conflict (name) do nothing;

-- Field schedules table (horarios de apertura por día)
create table if not exists public.field_schedules (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Domingo, 1=Lunes, etc.
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(field_id, day_of_week, start_time, end_time)
);

create index if not exists field_schedules_field_idx on public.field_schedules(field_id, day_of_week);

-- Insert default schedules for all courts (9:00 - 22:00 every day)
insert into public.field_schedules (field_id, day_of_week, start_time, end_time)
select f.id, d.dow, '09:00'::time, '22:00'::time
from public.fields f
cross join (
  select generate_series(0, 6) as dow
) d
on conflict do nothing;

-- Bookings table (reservas)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  field_id uuid not null references public.fields(id) on delete restrict,
  status booking_status not null default 'PENDIENTE_PAGO',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null,
  price_total_cents int not null default 0,
  currency text not null default 'CLP',
  -- Payment proof
  payment_proof_path text,
  payment_reference text,
  verification_note text,
  -- Audit trail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_source text not null default 'portal',
  status_updated_by uuid references auth.users(id) on delete set null,
  status_updated_at timestamptz,
  -- Constraints
  check (end_at > start_at),
  check (duration_minutes > 0)
);

create index if not exists bookings_user_idx on public.bookings(user_id, start_at desc);
create index if not exists bookings_field_time_idx on public.bookings(field_id, start_at, end_at);
create index if not exists bookings_status_idx on public.bookings(status);

-- Add generated column for overlap detection
alter table public.bookings
  add column if not exists booking_range tstzrange
  generated always as (tstzrange(start_at, end_at, '[)')) stored;

-- Exclusion constraint to prevent double bookings
-- Only applies to active statuses (not cancelled/rejected/expired)
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    field_id with =,
    booking_range with &&
  );

-- Field blocks table (bloqueos administrativos)
create table if not exists public.field_blocks (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists blocks_field_time_idx on public.field_blocks(field_id, start_at, end_at);

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for profiles
drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Trigger for bookings
drop trigger if exists update_bookings_updated_at on public.bookings;
create trigger update_bookings_updated_at
  before update on public.bookings
  for each row execute function public.update_updated_at_column();
