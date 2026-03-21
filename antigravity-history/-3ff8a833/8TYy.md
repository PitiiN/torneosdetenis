# Fluid Loading Implementation Plan

This plan replaces the blank "all-or-nothing" rendering with a "Carga Fluida" approach using visible loading indicators (spinners). This ensures users know the app is active while preventing partial UI "pops".

## Proposed Changes

### [Admin & User Screens]
#### [MODIFY] [app/(admin)/reviews.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/reviews.tsx)
#### [MODIFY] [app/(tabs)/index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
#### [MODIFY] [app/(admin)/dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
#### [MODIFY] [app/(admin)/payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/payments.tsx)
#### [MODIFY] [app/(admin)/students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)

- Update the early return for `!isLoaded`.
- Instead of a blank `View`, return a centered `ActivityIndicator` on the theme's background.
- Ensure `ActivityIndicator` is imported from `react-native`.

## Verification Plan

### Manual Verification
- Navigate to "Opiniones" (Admin) and "Inicio" (User) and verify a spinner appears briefly on a dark background before the full UI is revealed simultaneously.
- Verify the same for Dashboard, Finance, and Students.
