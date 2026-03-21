# Implementation Plan - Bug Fix Phase 3

This plan addresses the remaining scrolling issue, the profile import error, and the new 24h cancellation requirement.

## Proposed Changes

### 1. Profile Error Fix
- **File**: `app/(tabs)/profile.tsx`
- **Action**: Add `import { useAuthStore } from '@/store/auth.store';`.

### 2. Reliable Day Selector Scrolling
- **Files**: `app/(tabs)/index.tsx`, `app/(admin)/schedule.tsx`, `app/(admin)/dashboard.tsx`
- **Action**:
  - Refine the `useEffect` scroll logic.
  - Ensure the scroll happens after the content size has stabilized.
  - Increase centering offset for better visibility on small screens.

### 3. 24h Cancellation Rule
- **File**: `app/(tabs)/my-classes.tsx`
- **Action**:
  - Update `handleCancel` to use `24` hours as the limit.
  - Add logic to allow admins (`profile.role === 'admin'`) to cancel anytime.
  - Update UI badges and buttons to also reflect the 24h limit.

## Verification Plan

### Manual Verification
- **Scrolling**: Close app, open app, verify "Lunes 9 de Marzo" is centered in the carousel.
- **Cancellation**:
  - As student: Try cancelling a class in 12 hours. Expected: Failure alert stating 24h limit.
  - As student: Try cancelling a class in 48 hours. Expected: Success confirmation.
  - As admin: Try cancelling any enrollment. Expected: Success regardless of time.
- **Profile**: Press "Guardar cambios" and verify success alert without crash.
