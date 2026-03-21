# UI Refinements and Rendering Fixes

This plan addresses the need for a skip button on the splash screen and fixes flickering/incremental loading issues in the Admin Reviews and User Home screens.

## Proposed Changes

### [Splash Screen]
#### [MODIFY] [app/index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/index.tsx)
- Add a "Saltar" (Skip) button in the bottom right corner.
- Style it with a subtle dark theme (glassmorphism feel) to match the premium aesthetic.

### [Admin Reviews]
#### [MODIFY] [app/(admin)/reviews.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/reviews.tsx)
- Add a `loading` state to the `AdminReviewsScreen` component.
- Show a centered `ActivityIndicator` (spinner) while the first data load is in progress to prevent "popping" of the header and then the list.

### [User Home / Schedule]
#### [MODIFY] [app/(tabs)/index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- Add a `loading` state to the `HomeScreen` component.
- Ensure that the entire scrollable content (or at least the grid) doesn't show "empty" blocks until the server data (`classes`) has been retrieved.
- Show a themed loading indicator while the initial data is being fetched.

## Verification Plan

### Manual Verification
- **Splash Screen**: Open the app and verify the "Saltar" button appears and skips to the next screen immediately.
- **Admin Reviews**: Navigate to "Opiniones" and verify that a loader is shown instead of a half-rendered screen.
- **User Home**: Navigate to "Inicio" and verify that the grid doesn't flash empty blocks before painting them with statuses.
