# Plan de Desarrollo & Arquitectura — App de Arriendo de Canchas (Next.js + Tailwind + Supabase)
**Objetivo:** entregar a Google Antigravity (IDE) un blueprint end-to-end para generar el sistema completo: diseño, front, back, auth, DB, seguridad, despliegue en VPS (Dokploy) y operación.

---

## 0) Visión del producto (MVP con mentalidad de plataforma)
Una app simple y confiable donde:
1) **Usuario ve disponibilidad** de 3 canchas
2) **Usuario crea arriendo** (reserva)
3) **Usuario sube comprobante de transferencia**
4) **Admin valida** y marca como **PAGADA** (o rechaza)

El sistema debe manejar concurrencia (evitar dobles reservas) y proveer dashboards con indicadores y filtros.

---

## 1) Stack tecnológico (decisión cerrada)
- **Frontend / Fullstack:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (componentes) + lucide-react (iconos)
- **Gráficas:** recharts
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Deploy:** VPS con **Dokploy** (Docker) + Nginx/Traefik gestionado por Dokploy
- **VCS:** Git + GitHub

---

## 2) Requerimientos funcionales (RF)
### 2.1 Usuario (customer)
- RF-U01: Registro / Login (Supabase Auth)
- RF-U02: Ver disponibilidad por cancha + fecha (grilla diaria/semanal)
- RF-U03: Crear arriendo (con validación de conflicto)
- RF-U04: Modificar arriendo (solo si no está PAGADA/BLOQUEADA y dentro de políticas)
- RF-U05: Cancelar/eliminar arriendo (según política)
- RF-U06: Subir comprobante (archivo) y enviarlo a verificación
- RF-U07: Dashboard con:
  - arriendos activos / próximos
  - “estado” de cada reserva
  - mini disponibilidad de 3 canchas
  - filtros (cancha, estado, rango fecha)

### 2.2 Admin
- RF-A01: Ver todas las reservas con filtros avanzados
- RF-A02: Aprobar (marcar PAGADA) / Rechazar (con motivo)
- RF-A03: Bloquear slots (mantención/torneo)
- RF-A04: CRUD de canchas (si se requiere futuro)
- RF-A05: Auditoría de cambios (quién cambió estado, cuándo)
- RF-A06: Dashboard admin con métricas globales (reservas, ingresos estimados, tasa de rechazo, etc.)

---

## 3) Máquina de estados (reserva)
**Estados recomendados:**
- `HOLD` (bloqueo temporal opcional, 10 min) → expira
- `PENDIENTE_PAGO` (reserva creada, falta comprobante)
- `EN_VERIFICACION` (comprobante subido, esperando admin)
- `PAGADA` (confirmada)
- `RECHAZADA` (comprobante inválido o no coincide)
- `CANCELADA` (usuario/admin)
- `BLOQUEADA` (slot administrativamente no reservable)
- `EXPIRADA` (si aplica por reglas de negocio)

**Reglas clave:**
- Un usuario **no puede** editar fechas/horas si `PAGADA` o `BLOQUEADA`.
- Cambio a `PAGADA` solo por **admin**.
- `HOLD` es opcional: si el MVP va simple, se puede omitir y usar transacción/constraint para evitar doble reserva. Si se incluye, requiere job de expiración.

---

## 4) Arquitectura de alto nivel (lógica)
### 4.1 Patrón
- Next.js App Router
- Server Actions / Route Handlers para operaciones sensibles (crear/modificar/cancelar, admin approve)
- Supabase como fuente de verdad + RLS para seguridad

### 4.2 Principios de seguridad
- **RLS obligatorio**: el cliente solo ve y toca lo suyo.
- Operaciones admin con **roles** (custom claim o tabla `user_roles`).
- Subidas de comprobantes vía Supabase Storage con paths por usuario + política de lectura restringida.

---

## 5) Esquema de Base de Datos (SQL listo para Supabase)
> Copiar/pegar en el SQL Editor de Supabase.

### 5.1 Extensiones
```sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_phone_idx on public.profiles(phone);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'USER',
  created_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles(role);

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- ej: "HUELEN 7"
  location_text text,
  timezone text not null default 'America/Santiago',
  slot_duration_minutes int not null default 60,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.fields (name, slot_duration_minutes) values
('CANCHA 1', 60),
('CANCHA 2', 60),
('CANCHA 3', 60)
on conflict (name) do nothing;

create table if not exists public.field_schedules (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Domingo
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(field_id, day_of_week, start_time, end_time)
);

create index if not exists field_schedules_field_idx on public.field_schedules(field_id, day_of_week);

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

  -- Comprobante
  payment_proof_path text, -- storage path
  payment_reference text,  -- opcional: nro operación/folio
  verification_note text,

  -- Auditoría
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_source text not null default 'portal', -- portal/admin/api
  status_updated_by uuid references auth.users(id) on delete set null,
  status_updated_at timestamptz,

  -- Guardrails
  check (end_at > start_at),
  check (duration_minutes > 0)
);

create index if not exists bookings_user_idx on public.bookings(user_id, start_at desc);
create index if not exists bookings_field_time_idx on public.bookings(field_id, start_at, end_at);
create index if not exists bookings_status_idx on public.bookings(status);

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

create extension if not exists btree_gist;

alter table public.bookings
  add column if not exists booking_range tstzrange
  generated always as (tstzrange(start_at, end_at, '[)')) stored;

-- Solo aplica conflicto a estados que bloquean el slot
-- Nota: Postgres no soporta WHERE directo en EXCLUDE en versiones antiguas; se resuelve con bookings_active materializado o validación en función.
-- Simplificación práctica: aplica a todos salvo CANCELADA/RECHAZADA/EXPIRADA (se maneja por actualizaciones cuidadosas).
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    field_id with =,
    booking_range with &&
  );

create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = 'ADMIN'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

alter table public.user_roles enable row level security;

drop policy if exists "roles_admin_all" on public.user_roles;
create policy "roles_admin_all"
on public.user_roles for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table public.fields enable row level security;
alter table public.field_schedules enable row level security;

drop policy if exists "fields_select_all" on public.fields;
create policy "fields_select_all"
on public.fields for select
using (auth.uid() is not null);

drop policy if exists "fields_admin_write" on public.fields;
create policy "fields_admin_write"
on public.fields for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "schedules_select_all" on public.field_schedules;
create policy "schedules_select_all"
on public.field_schedules for select
using (auth.uid() is not null);

drop policy if exists "schedules_admin_write" on public.field_schedules;
create policy "schedules_admin_write"
on public.field_schedules for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table public.bookings enable row level security;

-- Usuario ve las suyas; admin ve todo
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
create policy "bookings_select_own_or_admin"
on public.bookings for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Crear: usuario crea para sí mismo (y no puede crear BLOQUEADA/PAGADA)
drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
on public.bookings for insert
with check (
  user_id = auth.uid()
  and status in ('PENDIENTE_PAGO','EN_VERIFICACION')
);

-- Update usuario: solo sus reservas y solo en estados permitidos
drop policy if exists "bookings_update_own_limited" on public.bookings;
create policy "bookings_update_own_limited"
on public.bookings for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and status not in ('PAGADA','BLOQUEADA')
);

-- Admin puede actualizar todo
drop policy if exists "bookings_admin_update_all" on public.bookings;
create policy "bookings_admin_update_all"
on public.bookings for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Delete: usuario solo si no está pagada/bloqueada (o se usa cancelación en vez de delete)
drop policy if exists "bookings_delete_own_limited" on public.bookings;
create policy "bookings_delete_own_limited"
on public.bookings for delete
using (
  user_id = auth.uid()
  and status not in ('PAGADA','BLOQUEADA')
);

alter table public.field_blocks enable row level security;

drop policy if exists "blocks_select_all" on public.field_blocks;
create policy "blocks_select_all"
on public.field_blocks for select
using (auth.uid() is not null);

drop policy if exists "blocks_admin_write" on public.field_blocks;
create policy "blocks_admin_write"
on public.field_blocks for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

7) Storage (comprobantes)

Bucket: payment-proofs (private)

Path recomendado: user/{user_id}/booking/{booking_id}/{filename}

Reglas:

Usuario: puede subir/leer solo sus archivos

Admin: puede leer todos

Nota: Las políticas de Storage se definen en Supabase Storage Policies (SQL o UI).

8) Backend (Next.js) — rutas y responsabilidades
8.1 Endpoints (Route Handlers)

POST /api/bookings → crear reserva

PATCH /api/bookings/:id → editar/cancelar (usuario)

POST /api/bookings/:id/proof → registrar path del comprobante (luego de subir a Storage)

GET /api/availability?fieldId=...&date=... → disponibilidad (combina bookings + blocks + schedules)

GET /api/admin/bookings → lista global con filtros

PATCH /api/admin/bookings/:id/status → aprobar/rechazar/pagar/bloquear

8.2 Lógica crítica: disponibilidad

Algoritmo:

obtener schedule del día para la cancha

construir slots por slot_duration_minutes

restar:

reservas activas que bloquean (PENDIENTE_PAGO, EN_VERIFICACION, PAGADA, BLOQUEADA)

bloqueos (field_blocks)

devolver slots libres + ocupados + metadata

9) Frontend (Next.js + Tailwind + shadcn/ui)
9.1 Vistas

/auth/login

/auth/register

/dashboard (usuario)

/bookings (mis reservas + filtros + CRUD)

/availability (grilla por cancha)

/admin (home admin)

/admin/bookings (bandeja verificación + filtros)

/admin/blocks (bloqueos)

/settings/profile

9.2 Componentes principales

AvailabilityGrid (daily/weekly toggle)

FieldSelector (3 canchas)

BookingFormModal (crear/editar)

BookingStatusBadge

ProofUploadCard

DashboardKpis (cards)

ChartsPanel (recharts)

FiltersBar (fecha, cancha, estado)

AdminVerificationQueue

9.3 UX/Políticas

Si el usuario intenta reservar un slot que se ocupó: mostrar “Slot ya no disponible” y refrescar.

Confirmaciones suaves (toasts) y “empty states” decentes.

Filtros persistentes en querystring para shareability.

.
├─ app/
│  ├─ layout.tsx
│  ├─ globals.css
│  ├─ (public)/
│  │  ├─ page.tsx
│  ├─ auth/
│  │  ├─ login/page.tsx
│  │  ├─ register/page.tsx
│  ├─ dashboard/page.tsx
│  ├─ bookings/page.tsx
│  ├─ availability/page.tsx
│  ├─ admin/
│  │  ├─ page.tsx
│  │  ├─ bookings/page.tsx
│  │  ├─ blocks/page.tsx
│  ├─ api/
│  │  ├─ bookings/route.ts
│  │  ├─ bookings/[id]/route.ts
│  │  ├─ bookings/[id]/proof/route.ts
│  │  ├─ availability/route.ts
│  │  ├─ admin/
│  │  │  ├─ bookings/route.ts
│  │  │  ├─ bookings/[id]/status/route.ts
│  │  │  ├─ blocks/route.ts
├─ components/
│  ├─ ui/ (shadcn)
│  ├─ availability/
│  ├─ bookings/
│  ├─ dashboard/
│  ├─ admin/
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts
│  │  ├─ server.ts
│  │  ├─ middleware.ts
│  ├─ auth/
│  ├─ validation/
│  ├─ dates/
│  ├─ pricing/
├─ middleware.ts
├─ types/
│  ├─ db.ts
│  ├─ domain.ts
├─ prisma/ (NO usar si ya hay Supabase; dejar vacío o eliminar)
├─ public/
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
└─ README.md

11) Autenticación (Supabase Auth)
11.1 Flujo

Registro: email/password → create user

Post-registro: upsert en profiles + row en user_roles (default USER)

Login: session cookie (SSR-friendly)

Middleware: proteger rutas privadas y rutas admin (verificar role)

11.2 Control de acceso admin

user_roles.role = ADMIN

Middleware en Next.js:

si ruta /admin/* y no es admin → redirect /dashboard

12) Diseño y sistema visual (Tailwind)

Layout: sidebar + topbar (dashboard/admin)

Tokens: spacing y typography consistente

Componentes shadcn:

Card, Badge, Button, Dialog, Tabs, DropdownMenu, Table, DatePicker

UX: priorizar “1 click, 1 acción” (menos fricción, más conversión)

13) Despliegue en VPS con Dokploy (Docker)
13.1 Dockerfile (Next.js)

Multi-stage build (deps → build → runner)

Variables env:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY (solo server)

NEXT_PUBLIC_APP_URL

13.2 Dokploy

Crear app desde repo GitHub

Build: Dockerfile

Exponer puerto 3000 internamente

Reverse proxy/SSL manejado por Dokploy

Configurar env vars en Dokploy

14) Git/GitHub — hygiene corporativa

Branches:

main (prod)

develop (staging)

feature/*

PR obligatorio con checklist:

pruebas manuales

lint

revisión de RLS impact

Releases con tags semver

15) Roadmap por fases (sin humo, con entregables)
Fase 1 — Fundaciones (Día 1–3)

Setup Next.js + Tailwind + shadcn

Supabase project + SQL schema + RLS

Auth (login/register) + middleware
Entregable: usuario entra, ve dashboard vacío.

Fase 2 — Disponibilidad y reservas (Día 4–8)

Availability API + grilla

Crear/editar/cancelar reservas

Constraint anti-overlap validado
Entregable: reservar funciona y no hay dobles reservas.

Fase 3 — Comprobante + verificación admin (Día 9–12)

Storage bucket + upload flow

Bandeja admin con approve/reject

Auditoría básica en booking
Entregable: flujo transferencia completo.

Fase 4 — Dashboard con gráficos y filtros (Día 13–15)

KPIs usuario y admin

Gráficas (recharts)

Filtros persistentes
Entregable: “one glance dashboard” real.

Fase 5 — Hardening (Día 16–18)

Edge cases (timezone, DST, límites de edición)

Observabilidad básica (logs)

Performance (índices, paginación)
Entregable: listo para producción.

16) Criterios de aceptación (CA) esenciales

CA01: Dos usuarios no pueden reservar el mismo slot (garantizado por DB)

CA02: Usuario solo ve y modifica sus reservas (RLS)

CA03: Admin puede ver todo y cambiar estado a PAGADA

CA04: Usuario puede subir comprobante y pasa a EN_VERIFICACION

CA05: Disponibilidad respeta schedules + blocks + reservas

CA06: Deploy en VPS con Dokploy funcionando con SSL

17) Notas de implementación “para evitar incendios”

Todo datetime en DB: timestamptz.

Definir timezone de operación (Chile/Santiago) y convertir en UI.

No hacer lógica de permisos en el front como “seguridad”: RLS manda.

Preferir cancelación (status) sobre delete para trazabilidad.

Mantener snapshot de precio en reserva para no reescribir historia.

18) Entregables finales (lo que debería quedar en repo)

Next.js app completa

SQL schema + RLS scripts versionados en /supabase/migrations

Documentación de env vars en .env.example

Dockerfile + instrucciones Dokploy

README con pasos de setup local

19) Definiciones rápidas (glosario)

Reserva/Arriendo/Booking: unidad principal.

Disponibilidad: slots generados por schedule menos ocupación/bloqueos.

Verificación: proceso admin de validar transferencia.

RLS: Row Level Security (Postgres) para control real.

20) Checklist “Go Live”

 SSL ok

 RLS probado (usuario no puede leer otros)

 Admin role asignado

 Storage policies ok

 Constraint no-overlap activo

 Backups y retención (Supabase)

 Alertas mínimas (errores 500 / logs)