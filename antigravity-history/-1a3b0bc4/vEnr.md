# Phase 13 Implementation Plan: Regressions & Timezones

## Goal
Resolve reported bugs including timezone shifts, payment upload failures, UI flickers, and logic inconsistencies in class displays.

## Proposed Changes

### [Component] User Interface (Home & My Classes)
#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- Strictly hide all class metadata if `status === 'cancelled'`, showing only "BLOQUEADA".

#### [MODIFY] [my-classes.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/my-classes.tsx)
- Correct the logic to find the single closest upcoming class.
- Add "No hay clases registradas" empty state for the hero card.

---

### [Component] Admin Management
#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- Sync "BLOQUEADA" label logic with user view.

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)
- Change date/time construction to avoid UTC conversion shifts. Use local ISO-like strings or manual formatting to preserve the selected hour.

#### [MODIFY] [config.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/config.tsx)
- Debug `handleSavePrices` to ensure the modal closes and loading state resets correctly.
- Ensure `app_settings` table is correctly accessed.

#### [MODIFY] [students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)
- Re-evaluate user filtering logic to ensure students of all status/roles appear.

#### [MODIFY] [_layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/_layout.tsx)
- Check if `detachInactiveScreens: false` or other Stack options help with the flicker.

---

### [Component] Payments
#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Add null checks for `asset` and `asset.uri` before calling `FileSystem`.
- Improve error handling in the upload flow.

## Verification Plan
### Manual Verification
- Create a class at 18:00 and verify it appears at 18:00 on the dashboard.
- Cancel a class and verify ONLY "BLOQUEADO" is shown.
- Upload a payment receipt and verify it works without "undefined" errors.
- Test student search for "Javier Aravena".
- Verify "Next Class" hero card shows the correct class.
