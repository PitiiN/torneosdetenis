# Court Rental Application - Development Tasks

## Phase 1: Project Scaffold (PASO 1)
- [x] Create Next.js App Router project with TypeScript
- [x] Install and configure Tailwind CSS
- [x] Install and configure shadcn/ui
- [x] Install lucide-react, recharts, zod
- [x] Create folder structure per blueprint
- [x] Create `.env.example` with required variables
- [x] Verify app runs with `npm run dev`

## Phase 2: Database & Security (PASO 2)
- [x] Create `/supabase/migrations/001_init.sql` with schema
- [x] Create `/supabase/migrations/002_rls.sql` with RLS policies
- [ ] Apply migrations to Supabase project
- [x] Configure Storage bucket `payment-proofs`

## Phase 3: Authentication & Roles (PASO 3)
- [x] Create Supabase client utilities (`lib/supabase/client.ts`, `server.ts`)
- [/] Implement `/auth/login` page
- [ ] Implement `/auth/register` page
- [ ] Create post-registration profile creation
- [ ] Implement middleware for route protection
- [ ] Verify auth flow works end-to-end

## Phase 4: Availability & Reservations (PASO 4)
- [ ] Implement `GET /api/availability` endpoint
- [ ] Implement `POST /api/bookings` endpoint
- [ ] Implement `PATCH /api/bookings/:id` endpoint
- [ ] Create `/availability` page with field selector and grid
- [ ] Create booking modal component
- [ ] Test conflict prevention (no double bookings)

## Phase 5: Payment Proof & Admin Verification (PASO 5)
- [ ] Implement proof upload flow (user)
- [ ] Create `/admin/bookings` page
- [ ] Implement `PATCH /api/admin/bookings/:id/status` endpoint
- [ ] Add approve/reject actions with audit trail
- [ ] Test complete verification flow

## Phase 6: Dashboards (PASO 6)
- [ ] Create `/dashboard` user page with KPIs
- [ ] Add charts with recharts
- [ ] Implement filters (persistent in querystring)
- [ ] Create `/admin` dashboard with global metrics

## Phase 7: UI Polish (PASO 7)
- [ ] Apply dark theme with blue accents from design
- [ ] Implement consistent card layouts
- [ ] Add badges, buttons, and table styling
- [ ] Ensure responsive design

## Phase 8: Deployment (PASO 8)
- [ ] Create production Dockerfile
- [ ] Create docker-compose.yml for local
- [ ] Document deployment in README
- [ ] Final validation and testing
