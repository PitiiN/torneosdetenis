# Implementation Plan - UI Refinements & Payment Sync

This plan addresses the requested UI changes in the Admin Dashboard, the student list search behavior, and ensures the "Usadas" class count in the user profile correctly reflects historical and future enrollments.

## Proposed Changes

### Database Functions
#### [MODIFY] [006_payment_receipts.sql](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/supabase/migrations/006_payment_receipts.sql)
- Update `get_student_class_allowance` to remove monthly partitioning for credits and usage. This will provide a "lifetime" balance or at least a cumulative one, ensuring that future and past classes are correctly accounted for against all approved payments.

### Admin Dashboard & Layout
#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- Remove "Ingresos mes actual" from the `STAT_CARDS` array.
- Adjust layout if needed to accommodate the missing card (though the grid should handle it).

#### [MODIFY] [AdminBottomBar.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/src/components/AdminBottomBar.tsx)
- Rename "Pagos" label to "Finanzas".
- Update all `QUICK_ACTIONS` colors to the primary purple (`colors.primary[500]`).
- Ensure active state styling uses the primary purple consistently for both icon and text.

### Admin Students Screen
#### [MODIFY] [students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)
- Update `filteredStudents` logic to return an empty array if `searchQuery` is empty.
- Initial list will show only a placeholder icon/text instead of all students.

## Verification Plan

### Manual Verification
1. **Payments Sync**: Log in as Javier Aravena and verify "Usadas" now shows 13 (4 past + 9 future) instead of 10.
2. **Admin Dashboard**: Verify "Ingresos mes actual" card is gone.
3. **Admin Navigation**: Verify the third button is named "Finanzas" and its active color is purple.
4. **Student Search**: Open "Alumnos" and verify list is empty until a search is performed.
