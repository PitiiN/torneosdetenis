# JJVV Mobile App — Implementation Plan

Complete mobile-only system for managing Chilean neighborhood associations (Juntas de Vecinos). Built with Expo + React Native + NativeWind, backed by Supabase (Auth + Postgres + Storage + Edge Functions). Optimized for elderly users with large typography, high contrast, and TTS.

## User Review Required

> [!IMPORTANT]
> **Supabase Project**: Will use the existing project `wlzqcrrkmaoqjqpkmigh` (us-west-2). All migrations, storage buckets, and edge functions will be deployed there. Confirm this is the correct project.

> [!WARNING]
> **Design Image**: The provided image is an icon set (community/organization icons on a blue gradient), not a detailed UI mockup with screen layouts. I will design the UI following the plan's specifications with a focus on accessibility for elderly users — large fonts, high contrast, blue theme inspired by the icon set, simple bottom-tab navigation.

> [!IMPORTANT]
> **Scope**: This is a very large project. I will create all files with functional skeleton code connected to Supabase, complete SQL migrations, RLS policies, and Edge Functions. Some admin screens will have basic CRUD patterns that can be fleshed out iteratively.

---

## Proposed Changes

### 1. Project Scaffolding

#### [NEW] [jjvv-mobile/](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile)

Initialize Expo app with TypeScript inside `jjvv-mobile/`. Structure:

```
jjvv-mobile/
├── app.json
├── App.tsx
├── babel.config.js
├── tailwind.config.js
├── nativewind-env.d.ts
├── global.css
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── eas.json
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   ├── queryClient.ts       # TanStack Query config
│   │   └── constants.ts         # App constants
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePushNotifications.ts
│   │   └── useTTS.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── AccessibilityContext.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthStack.tsx
│   │   ├── UserTabs.tsx
│   │   └── AdminTabs.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── ResetPasswordScreen.tsx
│   │   ├── user/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── AnnouncementsScreen.tsx
│   │   │   ├── EmergencyScreen.tsx
│   │   │   ├── AlertsScreen.tsx
│   │   │   ├── EventsScreen.tsx
│   │   │   ├── TicketsScreen.tsx
│   │   │   ├── DuesScreen.tsx
│   │   │   ├── DocumentsScreen.tsx
│   │   │   ├── MapScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   └── admin/
│   │       ├── DashboardScreen.tsx
│   │       ├── ManageAnnouncementsScreen.tsx
│   │       ├── ManageAlertsScreen.tsx
│   │       ├── ManageEventsScreen.tsx
│   │       ├── ManageTicketsScreen.tsx
│   │       ├── ManageMembersScreen.tsx
│   │       ├── ManageDuesScreen.tsx
│   │       ├── ManageFinanceScreen.tsx
│   │       ├── ManageDocumentsScreen.tsx
│   │       ├── ManagePoisScreen.tsx
│   │       ├── AuditLogScreen.tsx
│   │       └── ManageRolesScreen.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── TTSButton.tsx
│   │   ├── QuickActionCard.tsx
│   │   └── EmptyState.tsx
│   ├── services/
│   │   ├── authService.ts
│   │   ├── announcementService.ts
│   │   ├── alertService.ts
│   │   ├── eventService.ts
│   │   ├── ticketService.ts
│   │   ├── duesService.ts
│   │   ├── documentService.ts
│   │   ├── financeService.ts
│   │   ├── poiService.ts
│   │   └── pushService.ts
│   └── types/
│       └── database.ts
└── supabase/
    ├── migrations/
    │   ├── 001_init.sql           # Extensions + Enums + Tables + Indexes
    │   ├── 002_rls.sql            # RLS enable + all policies
    │   └── 003_functions.sql      # Helper functions + triggers
    └── functions/
        └── send_push/
            └── index.ts
```

---

### 2. Supabase Database (SQL Migrations)

#### [NEW] 001_init.sql
- Extensions: `uuid-ossp`, `pgcrypto`
- All 8 enums from the plan
- 14 tables: organizations, memberships, profiles, announcements, alerts, events, event_registrations, tickets, ticket_comments, dues_periods, dues_ledger, documents, pois, finance_entries, push_tokens, notifications, audit_log
- All indexes from the plan + additional performance indexes

#### [NEW] 002_rls.sql
- Enable RLS on ALL tables
- Policies per table based on role and organization membership:
  - **organizations**: members can SELECT their own org
  - **memberships**: members can view members of their org; president/superadmin can manage
  - **profiles**: users can manage their own profile; org members can view names
  - **announcements**: members can read; secretary/president can CRUD
  - **alerts**: members can read/create; moderator/president can moderate
  - **events**: members can read; secretary/president can CRUD
  - **event_registrations**: members can register/unregister themselves
  - **tickets**: members can create and view own; directiva can manage all
  - **ticket_comments**: ticket participants can read/write
  - **dues_periods**: members can read; treasurer can CRUD
  - **dues_ledger**: members can read own; treasurer can CRUD
  - **documents**: members can read public; secretary can CRUD
  - **pois**: members can read; secretary/president can CRUD
  - **finance_entries**: members limited view; treasurer CRUD; president approval
  - **push_tokens**: users manage own tokens
  - **notifications**: members can read org notifications
  - **audit_log**: president/superadmin can read

#### [NEW] 003_functions.sql
- `is_member_of(org uuid)` — checks active membership
- `has_role(org uuid, roles role_t[])` — checks role within org
- `updated_at` trigger function for tickets

---

### 3. Storage Buckets

Create 4 buckets with policies:
- **documents** — Actas, PDFs. Read: org members. Write: secretary/president.
- **receipts** — Payment proofs. Read: own user + treasurer. Write: member uploading own.
- **gallery** — Alert photos. Read: org members. Write: any member.
- **alerts** — Alert attachments. Read: org members. Write: any member.

---

### 4. Edge Function: `send_push`

#### [NEW] send_push/index.ts
- Receives `org_id`, `title`, `body`, `type`, `deep_link` via POST
- Queries `push_tokens` for enabled tokens in the org
- Sends via Expo Push API (`https://exp.host/--/api/v2/push/send`)
- Inserts record into `notifications` table
- Inserts record into `audit_log` for sensitive actions
- JWT-verified (requires auth)

---

### 5. Auth & Navigation

- **Supabase Auth**: Email/password registration and login
- **AuthContext**: Manages session, user profile, membership/role
- **RootNavigator**: If no session → AuthStack; if session → check role → UserTabs or AdminTabs
- **UserTabs**: Bottom tab with Home, Comunicados, Emergencias, Agenda, Más (drawer with remaining)
- **AdminTabs**: Bottom tab with Dashboard, Comunicados, Tickets, Socios, Más

---

### 6. Key Screen Implementations

All screens use NativeWind for styling with:
- Base font size 18px, scalable via preference
- Blue gradient theme (#1E3A5F → #2563EB inspired by icon set)
- High contrast text (white on dark blue, or dark on white)
- Minimum touch target 48x48dp
- TTS button on announcements using `expo-speech`

---

### 7. Push Notifications

- Use `expo-notifications` to request permissions and get push token
- Store token in `push_tokens` table on login
- Deep link configuration in app.json with scheme `jjvv`
- Linking config maps URLs like `jjvv://ticket/123` to TicketsScreen

---

### 8. Documentation

#### [NEW] README.md
- Setup instructions (install, env vars, Supabase config)
- Running locally with `npx expo start`
- EAS Build commands for internal distribution
- Edge function deployment instructions

#### [NEW] eas.json
- Build profiles: development, preview, production

---

## Verification Plan

### Automated Tests
1. **TypeCheck**: Run `npx tsc --noEmit` in `jjvv-mobile/` — should pass with 0 errors
2. **Lint**: Run `npx expo lint` — should pass

### Manual Verification
1. **Build**: Run `npx expo start` and verify the app launches on iOS/Android simulator
2. **Auth Flow**: Register → Login → verify role-based routing
3. **Supabase**: Execute migrations in Supabase SQL Editor and verify tables created
4. **RLS**: Test that a user from org A cannot see data from org B

> [!NOTE]
> Since this is a greenfield project, the primary verification is that the project compiles, TypeScript types are valid, and the app runs on Expo dev server. Full E2E testing requires a physical device or emulator with the Supabase backend configured.
