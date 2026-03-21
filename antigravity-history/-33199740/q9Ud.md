# Court Rental Application - Implementation Plan

Complete court rental system with Next.js (App Router), Tailwind CSS, shadcn/ui, and Supabase backend. Users can view availability, create bookings, upload payment proofs, and admins can verify payments.

---

## User Review Required

> [!IMPORTANT]
> **Supabase Project**: I found an existing project `wlzqcrrkmaoqjqpkmigh`. Should I use this one or create a new project for the court rental app?

> [!CAUTION]
> **Design Reference**: The provided `diseño.png` shows a sports/fan mobile app UI which doesn't directly match a court rental dashboard. I'll extract the **visual style** (dark theme, blue accents, card-based layout) and apply it to the court rental features defined in the blueprint.

---

## Proposed Changes

### Phase 1: Project Scaffold

---

#### [NEW] Next.js Project Structure

Creating the app with the following structure per blueprint:

```
ArriendoCanchas/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                    # Public landing
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/page.tsx          # User dashboard
│   ├── bookings/page.tsx           # User bookings
│   ├── availability/page.tsx       # View/book slots
│   ├── admin/
│   │   ├── page.tsx                # Admin dashboard
│   │   ├── bookings/page.tsx       # Verification queue
│   │   └── blocks/page.tsx         # Field blocks
│   └── api/
│       ├── bookings/route.ts
│       ├── bookings/[id]/route.ts
│       ├── bookings/[id]/proof/route.ts
│       ├── availability/route.ts
│       └── admin/
│           ├── bookings/route.ts
│           ├── bookings/[id]/status/route.ts
│           └── blocks/route.ts
├── components/
│   ├── ui/                         # shadcn components
│   ├── availability/
│   ├── bookings/
│   ├── dashboard/
│   └── admin/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── validation/
│   └── dates/
├── types/
│   ├── db.ts
│   └── domain.ts
├── middleware.ts
├── supabase/
│   └── migrations/
│       ├── 001_init.sql
│       └── 002_rls.sql
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

#### [NEW] Core Dependencies

- `tailwindcss`, `postcss`, `autoprefixer`
- `@radix-ui/*` (via shadcn)
- `lucide-react` (icons)
- `recharts` (charts)
- `zod` (validation)
- `@supabase/supabase-js`, `@supabase/ssr`

---

### Phase 2: Database Schema

---

#### [NEW] [001_init.sql](file:///supabase/migrations/001_init.sql)

Complete SQL from blueprint:
- Extensions: `uuid-ossp`, `pgcrypto`, `btree_gist`
- Enums: `booking_status`, `user_role`
- Tables: `profiles`, `user_roles`, `fields`, `field_schedules`, `bookings`, `field_blocks`
- Generated column `booking_range` for overlap detection
- Exclusion constraint `bookings_no_overlap` using GiST

#### [NEW] [002_rls.sql](file:///supabase/migrations/002_rls.sql)

RLS policies per blueprint:
- `is_admin()` function
- `profiles`: select/update/insert own + admin sees all
- `user_roles`: admin-only management
- `fields`, `field_schedules`: select for authenticated, admin writes
- `bookings`: select own/admin, insert own, update with status restrictions
- `field_blocks`: select authenticated, admin writes

---

### Phase 3: Authentication

---

#### [NEW] [client.ts](file:///lib/supabase/client.ts)

Browser Supabase client using `@supabase/ssr`

#### [NEW] [server.ts](file:///lib/supabase/server.ts)

Server-side Supabase client with cookie handling

#### [NEW] [middleware.ts](file:///middleware.ts)

Route protection:
- Public: `/`, `/auth/*`
- Protected (requires auth): `/dashboard`, `/bookings`, `/availability`
- Admin-only: `/admin/*` → check `user_roles.role = 'ADMIN'`

#### [NEW] Login/Register Pages

Using shadcn form components with Supabase Auth

---

### Phase 4: Core Functionality

---

#### [NEW] Availability API

`GET /api/availability?fieldId=...&date=...`
1. Get schedule for field/day
2. Generate slots per `slot_duration_minutes`
3. Subtract active bookings (PENDIENTE_PAGO, EN_VERIFICACION, PAGADA, BLOQUEADA)
4. Subtract field_blocks
5. Return slots with availability status

#### [NEW] Booking CRUD

- `POST /api/bookings`: Create with validation
- `PATCH /api/bookings/:id`: Edit/cancel (status restrictions enforced by RLS)
- DB constraint handles overlap conflicts → return user-friendly error

---

### Phase 5: Admin Verification

---

#### [NEW] Admin Bookings View

Table with filters: field, status, date range, user
Actions: View proof, Approve (PAGADA), Reject (with reason)

#### [NEW] Status Update API

`PATCH /api/admin/bookings/:id/status`
- Set `status`, `status_updated_by`, `status_updated_at`
- Server-side only (uses service role key)

---

### Phase 6: UI Design System

---

Based on the design image, applying:
- **Dark theme**: `#0a0e1a` background
- **Blue accent**: `#2563eb` to `#0ea5e9` gradient
- **Cards**: Rounded, subtle blue borders, glass effect
- **Typography**: Clean sans-serif, clear hierarchy
- **Badges**: Colored status indicators

---

### Phase 7: Deployment

---

#### [NEW] [Dockerfile](file:///Dockerfile)

Multi-stage build:
1. `deps`: Install dependencies
2. `builder`: Build Next.js
3. `runner`: Production image with standalone output

#### [NEW] [.env.example](file:///.env.example)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

---

## Verification Plan

### Automated Tests

1. **RLS Security Test** (SQL in Supabase):
   - Query as test user → should only see own bookings
   - Attempt to update another user's booking → should fail

2. **Overlap Constraint Test**:
   - Insert two bookings with same field/time → second should fail

3. **Build Verification**:
   ```bash
   npm run build
   npm run lint
   ```

### Manual Verification

1. **User Registration/Login Flow**:
   - Register new user → verify profile created
   - Login → verify redirect to dashboard
   - Logout → verify redirect to login

2. **Booking Flow**:
   - Navigate to `/availability`
   - Select field and date
   - Click available slot → booking modal opens
   - Confirm booking → verify in `/bookings`
   - Attempt same slot with different user → verify rejection

3. **Payment Proof Flow**:
   - Upload proof file for booking
   - Verify status changes to EN_VERIFICACION
   - As admin, view in `/admin/bookings`
   - Approve → verify status changes to PAGADA

4. **Admin Access Control**:
   - Non-admin user → `/admin` should redirect to `/dashboard`
   - Admin user → can access `/admin/*` routes

---

## Implementation Order

1. Scaffold project with Next.js + Tailwind + shadcn
2. Apply database migrations
3. Implement auth (login/register/middleware)
4. Build availability API + UI
5. Build booking CRUD
6. Implement payment proof upload
7. Build admin verification UI
8. Add dashboards with charts
9. Polish UI to match design
10. Create deployment files
