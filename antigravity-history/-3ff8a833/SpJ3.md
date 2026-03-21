# Custom Tennis Loading Implementation Plan

This plan replaces the standard activity indicators with a custom, branded loading component featuring a rotating tennis ball icon.

## Proposed Changes

### [New Component]
#### [NEW] [src/components/common/TennisLoading.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/src/components/common/TennisLoading.tsx)
- Create a reusable component that uses `Animated` to rotate an `Ionicons` tennis ball icon.
- Style it to be centered on the theme's background.

### [Apply to Screens]
#### [MODIFY] [app/(admin)/reviews.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/reviews.tsx)
#### [MODIFY] [app/(tabs)/index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
#### [MODIFY] [app/(admin)/dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
#### [MODIFY] [app/(admin)/payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/payments.tsx)
#### [MODIFY] [app/(admin)/students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)

- Import and use `TennisLoading` instead of the blank `View` or standard `ActivityIndicator` in the `!isLoaded` early return.

## Verification Plan

### Manual Verification
- Navigate between all modified screens and verify the rotating tennis ball appears briefly on a dark background.
- Ensure the animation is smooth and the icon matches the tennis theme.
