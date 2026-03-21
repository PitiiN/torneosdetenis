# Real-Time Synchronization for My Classes

Add Supabase real-time subscriptions to `my-classes.tsx` to ensure the "Next Class" hero card and "Upcoming Classes" list update immediately upon enrollment or cancellation.

## Proposed Changes

### [Component Name]

#### [MODIFY] [my-classes.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/my-classes.tsx)
- Add `useFocusEffect` from `expo-router` to trigger `load()` whenever the screen is focused.
- Remove `.slice(1)` from `listData` so that the first upcoming class is shown in both the Hero card and the list.
- Keep the real-time subscription for immediate updates while the screen is open.

## Verification Plan

### Manual Verification
1. Open "My Classes".
2. Go to "Inicio", enroll in a class.
3. Go back to "My Classes". Confirm it updated immediately (focus effect).
4. Verify the newly enrolled class is visible in both the Hero card (if it's the next one) and the "Futuras" list.
5. While on "My Classes", verify realtime updates if an admin cancels a class (realtime sync).
