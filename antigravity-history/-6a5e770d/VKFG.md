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
- [x] Notifications screen
- [x] Services (classes, enrollments, payments, notifications)

## Phase 5 — Configuration & Cleanup
- [x] Update `package.json` (name + entry point)
- [x] Remove old `App.tsx` and `index.ts`
- [x] Write README with assumptions
- [x] Verify database (10 tables, RLS, seed data)
- [x] TypeScript compilation — zero errors ✅
