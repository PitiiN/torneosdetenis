# Supabase Integration Walkthrough

We have successfully migrated the application from mock data to a live Supabase backend.

## Changes Applied

### Database
- **Created Tables**:
  - `profiles`: Linked to Supabase Auth users.
  - `time_entries`: Stores clock-in/out data.
  - `breaks`: Stores break intervals linked to time entries.
- **Security**: Enabled Row Level Security (RLS) on all tables so users can only access their own data.

### Frontend
- **Dependencies**: Installed `@supabase/supabase-js`.
- **Configuration**: Added `src/lib/supabaseClient.js` and updated `.env`.
- **Stores**:
  - **`authStore.js`**: Now uses `supabase.auth` for login, registration, and session management.
  - **`timeStore.js`**: Now performs real SQL queries (`insert`, `update`, `select`) instead of local storage operations.
- **Initialization**: Updated `App.jsx` to verify the user session when the app loads.

## How to Verify

1.  **Start the App**: Run `npm run dev`.
2.  **Register**: Go to `/register` and create a new account.
    - *Check*: You should be redirected to the dashboard.
    - *Check*: A new user should appear in the `profiles` table in Supabase.
3.  **Clock In**: Click "Marcar Entrada".
    - *Check*: The UI updates to "Trabajando".
    - *Check*: A new row is created in `time_entries`.
4.  **Breaks**: Test "Iniciar Pausa" and "Terminar Pausa".
    - *Check*: Rows are created/updated in the `breaks` table.
5.  **Clock Out**: Click "Marcar Salida".
    - *Check*: The `time_entries` row is updated with `clock_out` time and `total_hours`.
6.  **History**: Visit the History page to see your logged entries.

## Next Steps
- Implement comprehensive error handling in the UI (to show specific Supabase errors).
- Add profile editing functionality.
- Implement admin view (if required later).
