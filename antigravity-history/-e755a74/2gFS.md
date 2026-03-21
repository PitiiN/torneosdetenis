# Admin Features Implementation Plan

## Goal
1.  **Predefined Prices:** Auto-fill price based on court selection in Admin modals.
2.  **Past Bookings:** Show booking details for past slots instead of "-" in Admin grid.

## Proposed Changes

### 1. Predefined Prices
**Files:**
- `src/components/admin/PatternBookingModal.tsx`
- `src/components/admin/BookingEditModal.tsx`
- `src/lib/courtSchedules.ts` (Optional, good place for constants, but might just keep it simple in modals for now or adding to `COURT_SCHEDULES` object if it fits).

**Logic:**
- Huelén 7: $35.000
- Huelén 5: $15.000
- Tabancura 6: $30.000

**Implementation:**
- In `useEffect` listening to `fieldId`, update `priceTotal`.
- Use a helper logic:
  ```typescript
  const getPriceForField = (name: string) => {
      if (name.includes('Huelén 7')) return '35000'
      if (name.includes('Huelén 5')) return '15000'
      if (name.includes('Tabancura 6')) return '30000'
      return ''
  }
  ```

### 2. Past Bookings Visibility
**File:** `src/components/admin/AdminCalendarView.tsx`

**Logic:**
- Current: Checks `isBefore(now)` -> Returns 'past' -> Renders '-'.
- New: Check for `booking` FIRST.
    - If booking exists -> Return 'booked' (renders name/edit icon).
    - If no booking AND `isBefore(now)` -> Return 'past' (renders '-').

## Verification Plan
1.  **Past Bookings:**
    - Reload Admin view.
    - Check yesterday's bookings. They should show names instead of '-'.
    - Empty slots yesterday should still show '-'.
2.  **Predefined Prices:**
    - Open "Nueva Reserva" (Individual). Select "Huelén 7". Price should be 35000.
    - Change to "Huelén 5". Price should be 15000.
    - Open "Reserva Periódica". Select "Tabancura 6". Price should be 30000.
