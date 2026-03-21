# Implementation Plan - Tournament Bracket & Scoring Fixes

This plan addresses layout inconsistencies, positioning of the 3rd place match, empty consolation brackets, and the need for multi-set score inputs.

## Proposed Changes

### [Component] Tournament Bracket Layout (Sync & Positioning)

#### [MODIFY] [admin/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/%5Bid%5D.tsx)
- **Fix 3rd Place Match Position**: Modify the `marginBottom` logic. When rendering a match, if the *next* match in the same round is a 3rd place match, use a small gap instead of the calculated `matchGap`.
- **Align Score Display**: Ensure the split logic uses a robust regex `/[ -]/` to handle different separators.

#### [MODIFY] [tabs/tournaments/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28tabs%29/tournaments/%5Bid%5D.tsx)
- **Sync with Admin Layout**: Completely replace the bracket rendering loop with the logic from the admin view (using `initialMarginTop` and `matchGap` calculations) to ensure visual parity.
- **Remove Redundant Logic**: Delete the special `isFinalRound` block that was causing misalignment.

### [Component] Tournament Scoring

#### [MODIFY] [admin/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/%5Bid%5D.tsx)
- **Multi-set Score Editor**:
  - Update the `isEditModalVisible` modal to show multiple pairs of `TextInput` for each set.
  - Number of sets shown will depend on `tournament.set_type` (3 sets -> show 3 inputs, 5 sets -> show 5 inputs, etc.).
  - Update `saveMatchScore` to concatenate the set scores into the single `score` string expected by the database (e.g., "6-4 6-2").

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/create.tsx)
- **Consolation Format check**: Ensure that when `format === 'consolacion'`, the tournament matches are generated correctly with names starting with "Consolación". (The code seems to do this, but I will double check the strings).

## Verification Plan

### Manual Verification
1. **Admin Bracket View**:
   - Open a tournament with a 3rd/4th place match.
   - Verify that the 3rd place match is positioned directly below the Final match without excessive white space.
2. **User Bracket View**:
   - Log in as a student or use the user view simulation.
   - Open a tournament.
   - Verify that the bracket looks identical to the admin view (alignment, gaps, round names).
3. **Score Input**:
   - Open the score editor for a match in a "best3" tournament.
   - Verify that 3 set inputs are visible.
   - Enter "6-4" and "7-5".
   - Save and verify the bracket shows "6-4 7-5".
4. **Consolation Bracket**:
   - Create a new tournament with "Consolación" format.
   - Go to the tournament detail and switch to the "Consolación" tab.
   - Verify that the bracket is not empty and shows the consolation matches.
