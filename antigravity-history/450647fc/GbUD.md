# Implementation Plan - Day Selector Default Selection and Visibility

This plan addresses the issue where the day selector carousel does not automatically scroll to the selected (default) day when the screen is loaded.

## Proposed Changes

### Scheduling Views

I will modify the following files to include a `useRef` for the day carousel `ScrollView` and a `useEffect` to scroll the selected day into view on mount and whenever the selection changes.

#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- Import `useRef`.
- Add `dayStripRef` to the day carousel `ScrollView`.
- Add `useEffect` to scroll to the selected date.
- Calculate the scroll offset based on the day index and item width.

#### [MODIFY] [schedule.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/schedule.tsx)
- Similar changes as in the user index view.

#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- Similar changes as in the user index view.

## Verification Plan

### Manual Verification
- Open the application and verify that "Inicio" (User view) starts with the current day selected AND visible in the carousel.
- Navigate to the Admin Panel and verify the same for the Dashboard daily view and the Agenda Diaria.
- Change months in the carousel and verify that if the current day is in the selected month, it scrolls to it.
- Select different days and ensure they are highlighted.
