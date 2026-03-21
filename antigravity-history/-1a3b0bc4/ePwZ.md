# Implementation Plan - Phase 12: Sync, Upload, and Admin Refinement

## User Review Required
> [!IMPORTANT]
> - **Payment Upload**: I will switch to using `expo-file-system` for more robust file handling to fix the "Network request failed" error.
> - **Admin Transitions**: I will change the stack animation to `slide_from_right` or adjust background persistence to eliminate the white flicker.

## Proposed Changes

### [Component] Authentication & Database
#### [MODIFY] [config.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/config.tsx)
- Fix typo: `app_setting` -> `app_settings`.
- Ensure search is inclusive of all roles.

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Use `expo-file-system` to read the image URI and upload it to Supabase Storage accurately.
- Fix typo: `app_setting` -> `app_settings`.

---

### [Component] User Screens
#### [MODIFY] [my-classes.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/my-classes.tsx)
- Filter enrollments by `status='confirmed'` to hide cancelled sessions.

#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- Update blocked slot rendering: Show only "Bloqueada" without category name.

---

### [Component] Admin Screens
#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- Replace `useEffect` with `useFocusEffect` to ensure the dashboard refreshes when returning from the creation screen.
- Fix "Bloqueada" label and remove struck-through text.
- Ensure `blockHour` uses timezone-safe date construction.

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)
- Use strict ISO parsing/construction to ensure classes are saved in the correct time slot.

#### [MODIFY] [_layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/_layout.tsx)
- Change animation to `ios` or `slide_from_right` to avoid white flickers.

#### [MODIFY] [AdminBottomBar.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/src/components/AdminBottomBar.tsx)
- Adjust styling to remove horizontal scroll and fit all 6 actions in a static grid/row.

## Verification Plan

### Automated Tests
- N/A (Manual UI testing required)

### Manual Verification
- Verify "My Classes" doesn't show cancelled ones.
- Test Admin class creation and check if it reflects immediately on dashboard.
- Test payment receipt upload on Android.
- Check "Bloqueada" label appearance.
- Verify search finds "Javier Aravena".
- Verify Admin Bottom Bar layout on various screen sizes.
