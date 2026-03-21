# Fix Navigation Flash in Admin View

The user is experiencing white flashes during navigation in the admin section. This plan aims to ensure a consistent dark background across all layouts and transitions to eliminate these flashes.

## Proposed Changes

### [Core Layout]
#### [MODIFY] [app/_layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/_layout.tsx)
- Wrap the `<Slot />` component in a `<View>` with `flex: 1` and `backgroundColor: colors.background`. This ensures the root container is always dark.
- Ensure the `initializing` state also uses the same consistent background.

### [Admin Layout]
#### [MODIFY] [app/(admin)/_layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/_layout.tsx)
- Double-check `contentStyle` and potentially add `containerStyle` if available/needed.
- Keep `animation: 'none'` to minimize transition time.

### [Tabs Layout]
#### [MODIFY] [app/(tabs)/_layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/_layout.tsx)
- Add `sceneContainerStyle: { backgroundColor: colors.background }` to the `Tabs` component to ensure tab transitions don't flash white.

## Verification Plan

### Manual Verification
- Navigate between different sections of the Admin Panel (Dashboard, Students, Payments, etc.) and observe if the white flash persists.
- Test the transition from the main tabs to the admin panel.
- Verify the initial app load (splash video to main screen).
