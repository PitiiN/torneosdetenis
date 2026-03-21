# Admin Refinements Plan

## Overview
Update the layout and features for the Admin Panel, including dashboard stats, quick actions, new filters in Finanzas and Opiniones, converting the list to show all students, and enforcing current password when updating the password.

## Phase 7 — Admin Daily Management

### [Component] Admin Daily View `app/(admin)/dashboard.tsx`
- Replace the current "Stats grid" with a daily class block view (like student Home) that allows admins to see classes of the selected day.
- Add Month/Year filters for this view.
- Clicking a block will open a modal for Class Enrollment management.

### [Component] Class Enrollment Modal
- New modal to show student list for a class.
- Add "Add Student" button with searchable student list.
- Add "Edit Class" button to modify spots, coach, or category.

## Phase 8 — Enrollment Logic & User Payment UI

### [Component] Class Popup `app/(tabs)/index.tsx`
- Show "Cupos disponibles: X/Y".
- Implement 8-hour cancellation logic (disable cancel button if < 8h).

### [Logic] Enrollment Service `@/services/enrollments.ts`
- Check user's "classes_remaining" before allowing enrollment.
- Decrement/Increment "classes_remaining" on enrollment/cancellation.

### [Component] User Payments `app/(tabs)/payments.tsx`
- Add transfer details box (single copyable text).
- Add "Subir comprobante" button to upload receipt image to `payment_receipts`.

## Proposed Changes

### 1. Reordering Tabs & Quick Actions
- **`app/(tabs)/_layout.tsx`**: Move the 'Torneos' tab after 'Pagos' in the User Bottom Tabs.
- **`app/(admin)/dashboard.tsx`**: Update `QUICK_ACTIONS` to include `Panel Admin` first. We will also include `Torneos` (pointing to the user tournament screen) after `Finanzas`.
- We will refactor `QUICK_ACTIONS` to be a reusable component `AdminBottomBar` so it can be added to all Admin screens easily, fulfilling the request "En la vista 'Admin' debe haber un acceso rapido abajo".

### 2. Admin Dashboard Stats
- **`app/(admin)/dashboard.tsx`**: Remove 'Inscritos'.
- Add **'Alumnos activos'**: Will require a new query or RPC to count students with `remaining_classes > 0`.
- Add **'Ingresos del mes actual'**: Filter the `revenue` calculation to payments made in the current month.
- Keep **'Clases activas'**.

### 3. Reviews (Opiniones)
- **`app/(admin)/reviews.tsx`**: Add a month/year filter (same as in User Payments) to display reviews within that month.

### 4. Finances (Finanzas)
- **`app/(admin)/payments.tsx`**: (We will rename or repurpose this).
- Add year selector (dropdown for past/future up to 2030).
- Add month selector (carousel or arrows).
- Add "Inbox" style view for pending `payment_receipts`.
- Add a user search bar to filter receipts/payments by specific user.

### 5. Students List
- **`app/(admin)/students.tsx`**: Change the "Lista" quick action to point here. It will display all school students, overriding the current class list view.

### 6. Password Change
- **`app/(tabs)/profile.tsx`**: 
  - Add `currentPassword` state to the password change modal.
  - Implement a check using `supabase.auth.signInWithPassword()` before updating to the new password with `updateUser()`.

## Phase 9 — Splash Screen & App Selector

### Overview
Implement a native-like 4-second splash screen playing `LOGO_OBAT.mp4` on startup. Following the initial load, standard user state checking will bring the user to a Selection screen to choose "Escuela de Tenis" or "Arriendo de Canchas".

### [Feature] Loading Splash Screen `app/index.tsx`
- Setup an `expo-av` `<Video>` component stretching the screen.
- Autoplay `LOGO_OBAT.mp4` for 4 seconds. 
- After 4s, dispatch a route intercept to check auth status via Zustand.
- Push to `/login` if unauthenticated, else to `/selection`.

### [Feature] App Selector `app/selection.tsx`
- Present two cards: "Escuela de Tenis" and "Arriendo de Canchas" with corresponding icons.
- Interaction with "Escuela de Tenis" pushes into the core `/(tabs)` or `/(admin)` area.
- Interaction with "Arriendo de Canchas" fires an alert "Próximamente... 😉".

### [System] Routing Updates `app/_layout.tsx` & `app/(auth)/login.tsx`
- Refactor the current `AuthGate` to NOT auto-redirect to `/(tabs)`. 
- Allow the Splash screen and Login screen to deliberately navigate to `/selection`.

## User Review Required
> [!IMPORTANT]
> The routing logic will fundamentally change the initial landing page. Please confirm the flow: **Splash (4s) -> Login (if not loggged in) -> Selector -> App**.
