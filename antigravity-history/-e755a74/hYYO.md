# Financial Panel Refinements

## Goal
1.  **Total Card:** Rename "Deuda Total" to "Total" and display the sum of `Ingresos Confirmados` + `Pendiente de Cobro`.
2.  **User Names:** Ensure names appear. If no user profile is found or it's an anonymous booking, display "Admin" (or "Cliente Presencial").

## Changes

### Frontend
**File:** `src/app/(dashboard)/admin/financial/page.tsx`
- **Total Card:**
    - Label: "Total" (or "Total Esperado").
    - Value: `summary.totalRevenueCents + summary.pendingRevenueCents`.
    - Icon/Color: Maybe Purple or Neutral? User didn't specify, but "Total" implies a summary. Keeping it distinct.
- **User List:**
    - If `user.fullName` is "Sin Nombre", check logic.
    - If `user.userId` is "anonymous", display "Admin / Cliente Presencial".

### Backend
**File:** `src/app/api/admin/field-users/route.ts`
- **Name Logic:**
    - If `booking.user_id` is null, it's an Admin/Anonymous booking.
    - If `booking.user_id` exists but profile doesn't (rare but possible), fallback to "Usuario Eliminado" or "Desconocido".
    - Ensure `profilesMap` lookup is working correctly.

## Verification
- **Card:** Check that the 4th card shows the sum of the first two.
- **List:** Check that "Sin Nombre" is replaced by "Admin" or the actual user name.
