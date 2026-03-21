# Implementation Plan - Phase 11: Fixes & Advanced Admin Features

Addressing reported bugs and implementing missing administrative controls.

## Proposed Changes

### 📽️ Splash Screen
#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/index.tsx)
- Use `onPlaybackStatusUpdate` to detect end of video instead of a fixed 3s timer.

### 🏠 User Experience (Tabs)
#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- Fix the logic that filters classes by the selected day in the carousel.
- Ensure the `onPress` handler is correctly attached to class blocks.

#### [MODIFY] [my-classes.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/my-classes.tsx)
- Debug the query for `enrollments` to ensure objects are correctly filtered and displayed.

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Remove "Placeholder" text from `CLASS_PACKS` mapping.
- Investigate `processUpload` failure (ensure storage permissions and insert logic).

### 👮 Admin Features
#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- Update `hourBlockCancelled` style to use `colors.error` (red) as requested.

#### [MODIFY] [AdminBottomBar.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/src/components/AdminBottomBar.tsx)
- Fix the path for "Torneos" to point to an admin-specific route or ensure it doesn't drop the admin context.

#### [MODIFY] [config.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/config.tsx)
- Add "Asignar Roles" section with search and role update logic.
- Add "Configuración valores de clases" section (saving to a new `app_settings` table or similar).

### 🔍 Search Logic
- Investigate `profiles` query in `students.tsx` and `classes/create.tsx` to ensure all relevant users are searchable.

## Verification Plan
- Manual testing of each fix in the Expo environment.
- Verify role updates in Supabase dashboard.
- Verify price reflection in the User Payments screen.
