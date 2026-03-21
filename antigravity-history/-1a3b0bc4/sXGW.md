# Admin Refinements Plan

## Overview
Update the layout and features for the Admin Panel, including dashboard stats, quick actions, new filters in Finanzas and Opiniones, converting the list to show all students, and enforcing current password when updating the password.

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

## User Review Required
None required, directly implementing requested features.
