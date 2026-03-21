# Class Management Fixes Implementation Plan

This plan addresses the regressions found in the last APK build.

## Proposed Changes

### [Admin Class Management]
#### [MODIFY] [app/(admin)/classes/create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)
- **Timezone Fix**: Ensure timestamps sent to Supabase include the correct offset or are handled as unambiguous ISO strings.
- **UI Fix**: Change category and court selectors to `ScrollView horizontal` to act as carousels.

#### [MODIFY] [app/(admin)/classes/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/[id].tsx)
- **Persistence Fix**: Update the query to include `id` in `class_categories` join so the selection is correctly recognized.
- **UI Fix**: Change category selector to `ScrollView horizontal`.

## Verification Plan

### Manual Verification
1. Create a class at 22:00 and verify it appears at 22:00 in the grid.
2. Verify Categories can be scrolled horizontally.
3. Edit a class, change category, save, and reopen to verify it stays selected.
