# Implementation Plan - Fixing Physical Back Button Navigation

This plan addresses the issue where the Android physical back button consistently returns the user to the "Inicio" screen, regardless of their navigation history.

## Proposed Changes

### Navigation Infrastructure

I will change the root navigation component from `Slot` to `Stack` to enable proper history management. I will also adjust the behavior of the `Tabs` and `AdminBottomBar` to support history-aware navigation.

#### [MODIFY] [_layout.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/_layout.tsx)
- Replace `Slot` with `Stack`.
- Define initial routes and animations.
- Ensure `AuthGate` correctly wraps the `Stack`.

#### [MODIFY] [_layout.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/_layout.tsx)
- Add `backBehavior: 'history'` to the `Tabs` navigator to prevent always jumping back to the "Inicio" tab when pressing back.

#### [MODIFY] [AdminBottomBar.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/src/components/AdminBottomBar.tsx)
- Change `router.replace` to `router.push` to allow backtracking through admin sections as requested.

## Verification Plan

### Manual Verification
- Navigate from User View to Admin Panel. Press physical back button -> should return to User View.
- Navigate between Admin tabs (e.g., Dashboard -> Alumnos). Press back button -> should return to Dashboard.
- Navigate between User tabs (e.g., Inicio -> Perfil). Press back button -> should return to Inicio (if using 'history' behavior).
