# Tournament Final Refinements Plan

Addressing consolation bracket visibility, visual layout for 3rd place, and consistency for end-users.

## Proposed Changes

### [Component Name] [Tournament Details (Admin)]
#### [MODIFY] [[id].tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/[id].tsx)
- **3rd Place Positioning**: 
    - Identify `3er y 4to Puesto` matches and ensure they are rendered directly below the Final match of the SAME round, or with minimal vertical spacing instead of the round's calculated gap if it's too large.
    - Alternatively, adjust `initialMarginTop` for rounds containing a 3rd place match.
- **Consolation Filtering**:
    - Verify why `m.round_name.startsWith('Consolación')` might be failing. 
    - Ensure case sensitivity isn't an issue.

### [Component Name] [Tournament Details (User)]
#### [NEW] [user_id_sync](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/tournaments/[id].tsx)
- Sync the layout logic (the deterministic bracket calculation) from the admin view to the user-facing view.
- Ensure the user view also has the "Consolación" tab if applicable.

### [Component Name] [Tournament Creation]
#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/create.tsx)
- **Consolation Prefix**: Ensure the prefix is exactly `Consolación ` (with the accent and space).
- **Match Order**: Ensure `match_order` correctly sequences matches to avoid query-level shuffling.

## Verification Plan

### Manual Verification
1. **Consolation Visibility**:
    - Create a 4-player consolation tournament.
    - Check both tabs.
2. **3rd Place Layout**:
    - Check the Final round. The 3rd place match should be visible without scrolling deep down.
3. **User View Consistency**:
    - Access as a student.
    - Open the same tournament and verify it looks exactly like the admin version.
