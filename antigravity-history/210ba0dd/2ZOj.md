# Status Audit Report

## 1. Database State
- **Enum `booking_status`**: Contains `RECHAZADA` (along with PENDIENTE_PAGO, EN_VERIFICACION, PAGADA, CANCELADA, BLOQUEADA, EXPIRADA).
- **Existing Data**: 0 records found with 'RECHAZADA'. Safe to remove.

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

## Checklist
- [x] **Unificar Lógica de Estados**:
  - [x] Helper centralized (`src/lib/bookings/status.ts`).
  - [x] Admin views updated.
  - [x] Client views updated (via helper update).
- [x] **Eliminar RECHAZADA**:
  - [x] Mapped to CANCELADA in `getPublicStatus`.
  - [x] Mapped to 'Cancelada (Rechazada)' or hidden in Admin.
- [ ] **Manual Testing**:
  - Requires user validation.
- Need to map all "RECHAZADA" logic to "CANCELADA" or remove if unused.
