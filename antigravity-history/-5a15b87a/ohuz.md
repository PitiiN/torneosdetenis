# Admin Features Walkthrough

## Summary
Implemented two key administrative improvements:
1.  **Predefined Field Prices:** Automatically populates the correct price when creating or editing bookings.
2.  **Past Booking History:** Enables visibility of past bookings in the calendar grid.

## Changes

### 1. Predefined Prices
Modified `BookingEditModal.tsx` and `PatternBookingModal.tsx` to listen for field changes and apply the standard price from `COURT_SCHEDULES`.

- **Huelén 7:** $35.000
- **Huelén 5:** $15.000
- **Tabancura 6:** $30.000

The price field remains editable, but defaults to these values to save time.

### 2. Past Bookings
Modified `AdminCalendarView.tsx` to render booking details even if the slot is in the past.

**Logic Change:**
```javascript
// Before:
if (isPast) return '-'
if (booking) return booking.name

// After:
if (booking) return booking.name // Prioritize finding the booking
if (isPast) return '-'           // Only show '-' if slot was truly empty
```

### 3. Delete Booking
Added a "Delete" button (trash icon) to the Edit Reservation modal.
- Only visible for existing reservations (not new ones).
- Requires confirmation via browser dialog.
- Permanently removes the record from the database.

## Verification
- **Price Check:** Open "Nueva Reserva", select "Huelén 7", verify "35000" appears in the value field (not just placeholder). Switch to "Huelén 5", verifies update to "15000".
- **History Check:** Scroll to previous days in Admin view. Confirmed that past bookings show the user name instead of "-", while empty slots still show "-".
- **Delete Check:** Open an existing booking. Click the trash icon. Confirm the dialog. Verify the booking disappears from the grid.
