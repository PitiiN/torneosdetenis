# Implementation Plan - Bug Fix Phase 2

This plan addresses several reported bugs including the infinite loading screen, day selector visibility, and profile settings persistence.

## Proposed Changes

### 1. Infinite Loading Bug
- **File**: `app/_layout.tsx`
- **Action**:
  - Add a safety timeout in `AuthGate` to force `setInitializing(false)` after 6 seconds if it hasn't finished.
  - Call `setLoading(false)` from `useAuthStore` in the `finally` block of `initAuth`.
  - Wrap Supabase calls in more robust error handling.

### 2. "Arriendo de Canchas" Message
- **File**: `app/selection.tsx`
- **Action**: Update `handleArriendo` to display the exact requested message.

### 3. Day Selector Carousel Scrolling
- **Files**: `app/(tabs)/index.tsx`, `app/(admin)/schedule.tsx`, `app/(admin)/dashboard.tsx`
- **Action**:
  - Ensure the scroll logic triggers correctly on initial focus.
  - Use a slightly longer timeout (200ms) to account for layout rendering delays.

### 4. Profile Settings Persistence & Navigation
- **File**: `app/(tabs)/profile.tsx`
- **Action**:
  - Update `saveSettings` to also call `setProfile(updatedProfile)` in the global auth store.
  - Remove `setShowSettings(false)` after successful save.
  - Verify that the `Phone` field is correctly bound and saved.

## Verification Plan

### Manual Verification
- **App Startup**: Close and clear app state (if possible) and verify first-run behavior.
- **Navigation**: Verify "Arriendo de Canchas" alert content.
- **Carousel**: Verify immediate scrolling to the marked day.
- **Profile**: Save changes, verify remaining in the modal, and verify data persists after closing/reopening the modal.
