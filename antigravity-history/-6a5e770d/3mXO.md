# Escuela de Tenis — MVP Setup

## Phase 1 — Project Setup
- [x] Create Expo blank-typescript project
- [x] Install all SRS dependencies (Supabase, React Query, Zustand, etc.)
- [x] Configure `app.json` for dark theme + Expo Router
- [x] Configure `tsconfig.json` with `@/` path alias
- [x] Create `.env.local` with Supabase credentials
- [x] Create theme tokens (colors, typography, spacing)
- [x] Create Supabase client with expo-secure-store adapter

## Phase 2 — Database + RLS
- [x] Write `001_initial_schema.sql` (10 tables + constraints)
- [x] Write `002_rls_policies.sql` (role-based RLS with `get_my_role()`)
- [x] Write `003_functions.sql` (auto-profile trigger, view, RPCs)
- [x] Write `004_seed_data.sql` (courts, categories, plans)
- [x] Apply all 4 migrations to Supabase remote

## Phase 3 — Auth + Navigation
- [x] Create Zustand auth store
- [x] Create `useAuth` hook
- [x] Create auth service
- [x] Create root layout with Auth Gate
- [x] Create auth screens (login, register, forgot-password)
- [x] Create tab layout (5 tabs)

## Phase 4 — App Screens
- [x] Home screen (date strip + class cards)
- [x] Schedule screen (weekly view)
- [x] My Classes screen (upcoming/past)
- [x] Payments screen (summary + list)
- [x] Profile screen (avatar + logout)
- [x] Class detail screen (enrollment flow)
- [x] Admin dashboard (stats + quick actions)
- [x] Admin placeholder screens

## Phase 5 — Configuration & Cleanup
- [x] Update `package.json` (name + entry point)
- [x] Remove old `App.tsx` and `index.ts`
- [x] Write README with assumptions
- [x] Verify database (10 tables, RLS, seed data)
- [x] TypeScript compilation — zero errors ✅

## Phase 6 — Refinements & User Feedback
- [x] Add 'Torneos' tab replacing 'Horarios' 
- [x] Refactor 'Mis Clases' to include Past/Future filters
- [x] Unify bank text and align class packs in 'Pagos'
- [x] Add month filter to Payment receipt history
- [x] Implement in-app password update modal on 'Perfil'
- [x] Update Admin Dashboard stats (Active Students, Monthly Revenue)
- [x] Add Monthly Filter to Admin Reviews
- [x] Implement Advanced Filtering (Year/Month/Search) in Admin Finance
- [x] Standardize `AdminBottomBar` imports across all admin screens

## Phase 7 — Admin Daily Management
- [x] Implement Admin "Daily View" in `dashboard.tsx`
- [x] Implement Class Enrollment details popup for Admin
- [x] Add "Edit Class" (Category/Coach) and "Add Student Manually" functionality

## Phase 8 — Enrollment Logic & UI Polish
- [x] Add available spots count to user class popup
- [x] Implement 8-hour cancellation rule
- [x] Enforce enrollment limit based on paid classes
- [x] Update User 'Pagos' with transfer info box and upload receipt button
- [x] Ensure Tournament/Ranking shows "En construcción"
- [x] Fix Pack Card alignment issues in Payments
- [x] Fix double enrollment duplicate key bug

## Phase 9 — Splash Screen & App Selector
- [x] Implement `LOGO_OBAT.mp4` Splash Screen (`app/index.tsx`)
- [x] Intercept AuthGate routes to allow Splash
- [x] Build App Selector Screen (`app/selection.tsx`)
- [x] Route authenticated users to `/selection` instead of `/(tabs)`

## Phase 10 — UI/UX Polish, Admin Features & Bug Fixes
### Splash & Transitions
- [x] Update Splash Screen to `LOGO_OBAT_BOTE.mp4` (~3s), fix first-load hang
- [x] Change Admin navigation animation (slide to fade/fluid)

### Global UI Enhancements
- [x] Improve dark contrast (White text on time blocks)
- [x] Ensure custom App-styled Pop-ups (Remove native `Alert.alert`)
- [ ] Format all money values to CLP in Admin views
- [x] Remove "Argregar al calendario" buttons

### User Profile & Payments
- [x] Add WhatsApp contact button (+56995158428) in Profile
- [x] Confirm modal before submitting Payment Receipt
- [x] Show Receipt Rejection reason in user Payments

### Admin Dashboard & Classes
- [ ] Tap empty block in Dashboard to "Crear clase" or "Bloquear"
- [x] Show blocked blocks to users
- [x] Remove "Precio (CLP)" from Create Class
- [x] Cancel class push notification

### Admin Quick Actions & Finance
- [x] Remove "Agenda" quick access in Admin, rename "Lista" to "Alumnos"
- [x] Student list: Show full details (Modal with enrollment history)
- [x] Finance: Add reject logic + push notification
- [x] Finance: Fix filters (Inbox/History)
- [x] Fix Admin "Torneos" view (linked in bar)
- [x] Add "Config" quick access with "Cambiar a vista Usuario"
- [x] Fix Admin "Opiniones": Calculate total overall average
- [ ] Final verification of all Phase 10 items
