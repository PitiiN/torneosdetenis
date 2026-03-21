# Implementation Plan - Admin Create Class Refinements

This plan addresses UI and functional improvements in the Admin "Create Class" view.

## Proposed Changes

### app/(admin)/classes/create.tsx
- [MODIFY] Add `useRef` for the hour ScrollView.
- [MODIFY] Implement automatic scrolling for `selectedHour`.
- [MODIFY] Add extra bottom padding using `useSafeAreaInsets`.
- [MODIFY] Add a "Cancelar" button next to "Crear Clase".
- [MODIFY] Implement recurring creation logic:
    - Add states: `recurringEnabled`, `replicationCount`.
    - Integrated UI block for replication.
    - Refactor `handleSubmit` to perform batch operations.

## Verification Plan

### Manual Verification
- **Scrolling**: Open the screen with an `hour` param (e.g., from Dashboard) and verify the horizontal carousel is centered on that hour.
- **Form Layout**: Verify the bottom buttons are not obscured by phone navigation.
- **Recurring Creation**: Create a class and set it to replicate 3 times. Verify in the dashboard that 4 consecutive weekly classes were created.
- **Cancellation**: Verify the new Cancel button returns the user to the previous screen.
