# Implementation Plan - Bug Fix Phase 4

This plan addresses the cancellation rule failure and the persistent scrolling reliability issues.

## Proposed Changes

### 1. Unified Cancellation Rule in Student UI
- **File**: `app/(tabs)/my-classes.tsx`
- **Action**:
  - Remove the `isAdmin` bypass in the `handleCancel` logic.
  - This forces the 24h limit for *everyone* using the "Mis Clases" tab (student view).
  - Admins can still cancel any enrollment via the Admin Panel in `app/(admin)/classes/[id].tsx`.

### 2. Bulletproof Day Selector Scrolling
- **Files**: `app/(tabs)/index.tsx`, `app/(admin)/schedule.tsx`, `app/(admin)/dashboard.tsx`
- **Action**:
  - Add a dedicated `useLayoutEffect` or more robust `useEffect` for the initial scroll.
  - Use `onMomentumScrollEnd` or a similar event if needed, but primarily focusing on ensuring `onContentSizeChange` triggers correctly.
  - I will also ensure the item width (54) is accurate.

## Verification Plan

### Manual Verification
- **Cancellation**:
  - Verification: Try to cancel a class in "Mis Clases" with less than 24h remaining. It should be blocked regardless of whether the user is an admin or student.
  - Verification: As an admin, cancel an enrollment from a class detail screen in the Admin section. It should work.
- **Scrolling**:
  - Close app completely. Open app. Verify March 9 is centered.
  - Ensure it works on first launch.
