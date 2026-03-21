# Status Audit Report

## 1. Database State
- **Enum `booking_status`**: Contains `RECHAZADA` (along with PENDIENTE_PAGO, EN_VERIFICACION, PAGADA, CANCELADA, BLOQUEADA, EXPIRADA).
- **Existing Data**: *Checking pending count...*

## 2. Codebase Usage
- Found "RECHAZADA" in:
  - `src/types/db.ts` (TypeScript definition)
  - `src/components/admin/BookingEditModal.tsx` (UI option?)
  - `src/app/api/admin/financial/route.ts`
  - `src/app/api/admin/bookings/recurring/route.ts`
  - `src/app/api/admin/bookings/[id]/verify/route.ts`
  - `src/app/api/admin/bookings/[id]/route.ts`
  - `src/app/api/availability/week/route.ts` (Filtering)
  - `src/app/api/bookings/route.ts`
  - `src/components/ui/badge.tsx` (Styling?)
  - `src/app/(dashboard)/bookings/page.tsx`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/app/(dashboard)/admin/page.tsx`
  - `src/app/(dashboard)/admin/bookings/page.tsx`

## 3. Discrepancies
- "RECHAZADA" is historically entrenched but user explicitely requested removal.
- Need to map all "RECHAZADA" logic to "CANCELADA" or remove if unused.

