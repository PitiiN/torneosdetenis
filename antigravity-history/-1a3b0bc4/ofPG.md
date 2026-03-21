# Real-Time Synchronization for Schedule, My Classes & Payments

This plan covers adding real-time updates and improved navigation synchronization across the entire student experience.

## Proposed Changes

### [Home / Schedule]

#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/index.tsx)
- Import `useFocusEffect` from `expo-router`.
- Use `useFocusEffect` to reload `loadClasses()` and `loadAllowance()` when the screen is focused.
- Set up a real-time subscription for `enrollments` and `classes` tables.
- This ensures the capacity (cupos) in each cell updates immediately when anyone enrolls or cancels.

---

### [My Classes]

#### [MODIFY] [my-classes.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/my-classes.tsx)
- Added `useFocusEffect` to trigger `load()` whenever the screen is focused.
- Ensured all upcoming classes are visible in the list.

---

### [Payments]

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Added `useFocusEffect` to reload data when the screen is focused.
- Real-time subscription for allowance updates.

---

### [Phase 17: Fix Payment Upload Error]

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Refactor `processUpload` to use `fetch(asset.uri)` and `response.blob()` instead of `FileSystem.readAsStringAsync` with base64 conversion and manual ArrayBuffer creation.
- This is a more robust method for Supabase Storage uploads and avoids potential "base64 of undefined" issues.
- Remove `base-64` dependency if no longer used.

---

### [Phase 18: Fix "Network request failed" in Upload]

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Refactor `processUpload` to use `FormData` for the Supabase Storage upload. 
- In React Native/Expo, providing a `Blob` created via `fetch().blob()` sometimes causes "Network request failed" in the Supabase client.
- `FormData` with a `{ uri, name, type }` object is the most reliable way to handle file uploads in this environment.

---

### [Phase 19: Fix Admin Finance Error]

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/payments.tsx)
- Move the `isSameMonth` helper function definition above the `useMemo` where it is used.
- Rename it to `checkIsSameMonth` to avoid confusion with potential `date-fns` imports.

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Replace `ImagePicker.MediaTypeOptions.Images` with `ImagePicker.MediaType.Images` to address the deprecation warning.

## Verification Plan

### Manual Verification
1. **Schedule Capacity Sync**: Open "Inicio" (Schedule). In another tab or as another user, enroll in a class. Confirm the "cupos" count for that class updates immediately without refreshing.
2. **Schedule Focus Refresh**: Navigate between tabs and confirm the schedule data is always fresh.
3. **Enrollment/Cancellation Flow**: Verify that when a user cancels from "My Classes", they can see the updated capacity immediately upon returning to "Inicio".
