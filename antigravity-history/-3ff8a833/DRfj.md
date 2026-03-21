# Fix App Crash and Timezone Regressions

Ensure correct date parsing, consistent timezone handling across all administrative screens, and prevent app crashes due to invalid date formats.

## Proposed Changes

### [Admin Dashboard](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/dashboard.tsx)

#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/dashboard.tsx)
- Change date parameter passed to `classes/create` to use `YYYY-MM-DD` format instead of `toISOString()` to avoid parsing errors in `create.tsx`.
- Fix `blockHour` to use proper `Date` objects and `toISOString()` to ensure consistent timezone handling in the database.

### [Class Creation](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/classes/create.tsx)

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/classes/create.tsx)
- Update initial state logic for `selectedDate` and `calendarMonth` to safely handle different input formats from `useLocalSearchParams`.
- Ensure `toISOString()` is only called on valid `Date` objects.

### [Daily Schedule](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/schedule.tsx)

#### [MODIFY] [schedule.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/schedule.tsx)
- Ensure date range queries for classes cover the full 24-hour period correctly regardless of timezone.

## Verification Plan

### Automated Tests
- Manual verification of class creation and blocking on the device after compilation.

### Manual Verification
- Verify that a class created at 22:00 appears at 22:00 in both Dashboard and Agenda.
- Verify that "Block" also works without the 3-hour shift.
- Confirm "Create Class" button no longer crashes the app.
