# Implementation Plan - UI Refinements & Payment Sync V2

This plan addresses the requested UI changes in the Admin Dashboard, the student list search behavior, and adds a monthly selector for class allowances in the user profile.

## Proposed Changes

### Database Functions
#### [MODIFY] [006_payment_receipts.sql](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/supabase/migrations/006_payment_receipts.sql)
- Update `get_student_class_allowance` to accept an optional `p_date` parameter.
- Filter both `payment_receipts` (granted) and `enrollments` (used) by the provided month.

### Payments Screen (User)
#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Use `currentMonth` (already used for receipts history) to also filter the class allowance.
- Move the month selector component above the logic that displays `allowance`.
- Update the `load` function to pass `currentMonth.toISOString()` to the `get_student_class_allowance` RPC.

### Admin Dashboard & Layout
#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- Remove "Ingresos mes actual" from the `STAT_CARDS` array.

#### [MODIFY] [AdminBottomBar.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/src/components/AdminBottomBar.tsx)
- Rename "Pagos" label to "Finanzas".
- Update all `QUICK_ACTIONS` colors to the primary purple (`colors.primary[500]`).
- Ensure active state styling uses the primary purple consistently.

### Admin Students Screen
#### [MODIFY] [students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)
- Update `filteredStudents` logic to return an empty array if `searchQuery` is empty.
- Initial list will show only a placeholder icon/text instead of all students.

## Verification Plan

### Manual Verification
1. **Payments Sync**: Log in as a user and change months. Verify that "Usadas" and "Pagadas" change according to the month's records.
2. **Admin Dashboard**: Verify "Ingresos mes actual" card is gone.
3. **Admin Navigation**: Verify the third button is named "Finanzas" and its active color is purple.
4. **Student Search**: Open "Alumnos" and verify list is empty until a search is performed.
