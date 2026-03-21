# Escuela de Tenis — MVP Walkthrough

## What Was Built

Complete MVP scaffold for a tennis school management app (iOS/Android), including:

### 🗄️ Database (Supabase Remote)
All migrations applied to project `tbahjhufxmsyldhghhhz`:

| Migration | Content |
|-----------|---------|
| `001_initial_schema.sql` | 10 tables with constraints, indexes, `btree_gist` extension, anti-overlap exclusion constraint per court |
| `002_rls_policies.sql` | Full RLS with `get_my_role()` SECURITY DEFINER helper — no infinite recursion |
| `003_functions.sql` | Auto-profile trigger on auth signup, `classes_with_availability` view, RPCs |
| `004_seed_data.sql` | 2 clay courts, 5 class categories, 4 payment plans |

### 📱 App Screens
- **Auth**: Login, Register, Forgot Password — dark theme with purple accents
- **Home**: Greeting, admin banner, horizontal 7-day date strip, class cards with availability indicators
- **Schedule**: Week navigation, classes grouped by day with time blocks
- **My Classes**: Upcoming/past filter, enrollment cards with cancel option
- **Payments**: Summary cards (paid/pending/overdue), payment history with status badges
- **Profile**: Avatar circle, role badge, admin panel link, logout
- **Class Detail**: Category badge, info grid, availability progress bar, enroll CTA
- **Admin Dashboard**: Stats grid, quick actions, upcoming classes
- **Notifications**: Read/unread state, type icons, mark all read

### 🧩 Architecture
- **Expo Router** file-based navigation with auth gate (`(auth)`, `(tabs)`, `(admin)` groups)
- **Zustand** auth store with session + profile
- **Supabase client** with `expo-secure-store` adapter
- **Services layer**: classes, enrollments, payments, notifications

## Verification

| Check | Result |
|-------|--------|
| TypeScript compilation (`tsc --noEmit`) | ✅ Zero errors |
| Database tables (10 tables, all RLS enabled) | ✅ Verified |
| Seed data (2 courts, 5 categories, 4 plans) | ✅ Loaded |
| Package.json entry point | ✅ `expo-router/entry` |

## Next Steps
1. Run `npx expo start` to launch on device/simulator
2. Create first admin user via Supabase Auth → then set role to `admin` in `profiles` table
3. Implement full admin CRUD screens (currently placeholders)
4. Add push notifications (v1.1)
5. Implement class recurrence (v1.1)
