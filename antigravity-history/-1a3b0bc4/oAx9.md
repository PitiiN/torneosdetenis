# Escuela de Tenis — MVP Implementation Plan

## SRS Summary (10 bullets)

1. **Mobile app (iOS/Android)** for managing a tennis school: classes, courts, coaches, students, payments
2. **3 roles**: Admin (full CRUD), Coach (view assigned classes), Student (browse/enroll)
3. **2 courts**, operating hours 08:00–22:00, anti-overlap constraint per court
4. **Class enrollment** with real-time spot tracking, waitlist, and automatic payment creation
5. **Rain rescheduling**: cancel original → create replacement → link via `class_reschedules` → migrate enrollments → notify
6. **Payments**: pending/paid/overdue lifecycle, admin marks payments, per-class or per-plan
7. **In-app notifications** via `notifications` table; push notifications as stub
8. **RLS policies** enforce role-based data access (students see own data, admins see all)
9. **Calendar views**: day/week/month with category colors and spot indicators
10. **Auth via Supabase**: email/password, auto-profile creation trigger, SecureStore for tokens

## Assumptions (documented in README)

1. Currency is CLP (Chilean Peso), no online payment gateway in MVP
2. Push notifications are stub-only; in-app notifications fully functional
3. Google OAuth is deferred to post-MVP
4. Dark mode deferred to post-MVP; light theme only
5. Recurrence (RRULE) deferred; classes are created individually per session
6. `student_credits` table created but credit logic deferred to v1.1
7. Coach cannot create classes independently — only Admin creates/assigns
8. Attendance marking deferred to post-MVP
9. Image/avatar upload deferred; placeholder avatars used
10. The app targets Expo Go for development; EAS build for production is documented but not executed

## User Review Required

> [!IMPORTANT]
> **Supabase Project**: No existing Supabase project for "Escuela de Tenis" was found. I will create a **new Supabase project** in your organization `ynhvejcbthxduhistcng`. Please confirm this is OK, or provide a different org/project.

> [!WARNING]
> **Color Theme**: The reference image shows a **dark theme** with vibrant purple (#7C3AED), green (#22C55E), orange (#F97316), and pink (#EC4899) accents on a black background. The SRS defines an indigo-based light theme. I will **derive tokens from the reference image** (dark background + purple primary) as requested, diverging from the SRS color scheme.

---

## Proposed Changes

### Project Scaffold

#### [NEW] `package.json`, `tsconfig.json`, `app.json`
- Expo project with TypeScript, Expo Router, all SRS dependencies

#### [NEW] `src/theme/colors.ts`
- Dark theme tokens derived from reference image:
  - `primary`: `#7C3AED` (purple)
  - `secondary`: `#22C55E` (green)
  - `accent`: `#F97316` (orange)
  - `background`: `#0A0A0A` (near-black)
  - `surface`: `#1A1A2E` (dark card)
  - `text`: `#FFFFFF`
  - `success/warning/error` semantic colors

#### [NEW] `src/theme/typography.ts`, `spacing.ts`, `theme.ts`
- Typography, spacing, and unified theme export per SRS

#### [NEW] `src/services/supabase.ts`
- Supabase client with `expo-secure-store` adapter

#### [NEW] `.env.example`
- Template with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

### Database Migrations (`supabase/migrations/`)

#### [NEW] `001_initial_schema.sql`
- All tables: `profiles`, `courts`, `class_categories`, `classes`, `enrollments`, `payment_plans`, `payments`, `notifications`, `class_reschedules`, `student_credits`
- Indexes, constraints, generated columns per SRS
- Anti-overlap exclusion constraint using `btree_gist` extension

#### [NEW] `002_rls_policies.sql`
- Enable RLS on all tables
- Per-role policies exactly as defined in SRS §7.4

#### [NEW] `003_functions.sql`
- `update_updated_at_column()` trigger function
- `handle_new_user()` trigger on `auth.users`
- `get_available_classes()` RPC function
- `get_student_payment_summary()` RPC function
- `classes_with_availability` view

#### [NEW] `004_seed_data.sql`
- 2 courts (Cancha 1, Cancha 2) — clay, outdoor
- 5 class categories (Iniciación through Competición)
- 4 payment plans
- 1 admin test user profile (email: `admin@escuelatenis.cl`)

---

### App Entry Points

#### [NEW] `app/_layout.tsx`
- Root layout with auth gate logic

#### [NEW] `app/(auth)/_layout.tsx`, `login.tsx`, `register.tsx`, `forgot-password.tsx`
- Auth stack (placeholder screens for Phase 1, functional in Phase 3)

#### [NEW] `app/(tabs)/_layout.tsx` + tab screens
- 5-tab layout: Home, Schedule, My Classes, Payments, Profile (placeholders)

#### [NEW] `README.md`
- Setup instructions, env vars, how to apply migrations, how to run

---

## Verification Plan

### Automated Tests
- No automated tests in Phase 0/1; project scaffold verified by successful `npx expo start`

### Manual Verification (Phase 1)
1. Run `npm install` — should complete without errors
2. Run `npx expo start` — should show QR code and no TypeScript errors
3. Open in Expo Go — should show placeholder screens
4. Apply SQL migrations to Supabase remote via SQL Editor — should succeed without errors
5. Verify tables exist in Supabase Dashboard → Table Editor
6. Verify RLS is enabled on all tables in Supabase Dashboard → Auth → Policies

### Manual Verification (Phase 2+)
- User registers → profile auto-created → role = student
- User logs in → redirected to tabs
- Admin logs in → sees admin dashboard
- Student cannot access admin routes
- Enroll in class → enrollment created + payment pending
- Admin cancels class for rain → replacement created + enrollments migrated
