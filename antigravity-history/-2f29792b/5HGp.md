# Implementation Plan - Bug Fix Phase 5

This plan comprehensively fixes the cancellation rule by updating the Home screen modal and any other missed spots.

## Proposed Changes

### 1. Fix Cancellation in Home Modal
- **File**: `app/(tabs)/index.tsx`
- **Action**:
  - Update `handleCancelEnrollment` to use the **24-hour** rule instead of 8.
  - Use `differenceInHours` from `date-fns` for consistency.
  - Hide the "Cancelar" button in the modal if the class starts in less than 24 hours.

### 2. Audit Other Screens
- I'll quickly check `app/class/[id].tsx` again to ensure no "Cancel" button exists there (usually it's only for enrollment).

## Verification Plan

### Manual Verification
- **Home screen**: Click on the class at 15:00 tomorrow. Verify that the "Cancelar clase" button is NOT visible in the modal.
- **My Classes**: Re-verify that the button is also not visible there for that class.
