# Cleanup Audit
**Date:** 2026-02-06
**Status:** Ready for Execution

## 1. Inventory Summary
- **Routes**: Admin routes mapped (`availability`, `bookings`, `blocks`).
- **Components**: `AdminCalendarView` (Active), `PatternBookingModal` (Active), `RecurringBookingModal` (Legacy).
- **APIs**: `admin/bookings/route.ts` lacks validation.

## 2. Findings

### Code Duplication / Legacy
- `src/components/admin/RecurringBookingModal.tsx`: Unused. Superseded by `PatternBookingModal`.
- `src/components/ui/fixed-calendar.tsx`: Deleted (verified).

### API Issues
- Manual query parsing in `bookings/route.ts`.
- No Zod validation for inputs.
- Manual Admin role check (repetitive).

### Helpers
- `src/lib/utils.ts` is minimal (only `cn`).
- Need dedicated helpers for Auth assertions and Datetime.

## 3. Action Plan (Execution)

### A. Remove Dead Code
- Delete `src/components/admin/RecurringBookingModal.tsx`.

### B. Consolidate & Refactor
- Create `src/lib/validations/admin.ts` (Zod schemas).
- Create `src/lib/auth/admin.ts` (Admin role verification helper).
- Refactor `src/app/api/admin/bookings/route.ts` to use new helpers.

### C. Dependencies
- Confirm only necessary packages remain.
