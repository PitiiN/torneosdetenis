# Walkthrough - Day Selector Fixes

I have implemented automatic scrolling for the day selector carousels in both User and Admin views. This ensures that the selected day (which defaults to today) is always visible when the screen loads or when the month is changed.

## Changes Made

### Scheduling Views

I added `useRef` to target the `ScrollView` of the day carousels and a `useEffect` hook to calculate the scroll position and perform an animated scroll to the selected date.

- **User Home Screen**: [index.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- **Admin Agenda**: [schedule.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/schedule.tsx)
- **Admin Dashboard**: [dashboard.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)

## Verification Results

### Manual Verification
- Verified that the "Inicio" tab correctly scrolls to the current day on startup.
- Verified that the Admin Dashboard daily view scrolls to the current day.
- Verified that the Admin Agenda scrolls to the current day.
- Verified that changing months updates the carousel and scrolls to the selected day if it's within the new month's range.
