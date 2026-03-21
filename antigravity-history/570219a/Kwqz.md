# Implementation Plan - Supabase Integration

We will replace the local mock data storage with a persistent Supabase backend.

## Proposed Changes

### Database Schema (Supabase)

We need 3 main tables to mirror the current data structure.

#### 1. `public.profiles`
Extends the default `auth.users` table.
- `id`: uuid (PK, FK to auth.users.id)
- `email`: text
- `full_name`: text
- `avatar_url`: text
- `role`: text (default: 'employee')
- `department`: text
- `created_at`: timestamptz

#### 2. `public.time_entries`
Stores the main clock-in/clock-out records.
- `id`: uuid (PK)
- `user_id`: uuid (FK to profiles.id)
- `date`: date (for easier querying by day)
- `clock_in`: timestamptz
- `clock_out`: timestamptz (nullable)
- `total_hours`: numeric (nullable, calculated or stored)
- `notes`: text
- `created_at`: timestamptz

#### 3. `public.breaks`
Stores breaks related to a specific time entry.
- `id`: uuid (PK)
- `entry_id`: uuid (FK to time_entries.id)
- `start_time`: timestamptz
- `end_time`: timestamptz (nullable)
- `duration_minutes`: integer (nullable)
- `created_at`: timestamptz

### Security (RLS)
- Enable RLS on all tables.
- Policies:
    - Users can read/insert/update their own rows.
    - (Future) Admins can read all rows (will implement basic "own data" first).

### Codebase Changes

#### [NEW] [supabaseClient.js](file:///src/lib/supabaseClient.js)
- Initialize the Supabase client using environment variables.

#### [MODIFY] [authStore.js](file:///src/store/authStore.js)
- Replace `MOCK_USERS` and localStorage logic with `supabase.auth`.
- Implement `login` (signInWithPassword), `register` (signUp), `logout` (signOut).
- Sync `auth.onAuthStateChange` to keep store updated.

#### [MODIFY] [timeStore.js](file:///src/store/timeStore.js)
- Replace `localStorage` logic with SQL queries via Supabase client.
- `clockIn` -> Insert into `time_entries`.
- `clockOut` -> Update `time_entries` (set clock_out).
- `startBreak`/`endBreak` -> Insert/Update `breaks` table.
- `getHistory` -> Select from `time_entries` with joins on `breaks`.

## Verification Plan

### Manual Verification
1. **Auth**: Register a new user, ensure profile is created in `public.profiles`. Log out and log back in.
2. **Flow**:
   - Click "Marcar Entrada". Check Supabase `time_entries`.
   - Click "Iniciar Pausa". Check Supabase `breaks`.
   - Click "Terminar Pausa". Verify update.
   - Click "Marcar Salida". Verify `clock_out` and calculations.
3. **History**: Verify the history page loads data from the DB.
