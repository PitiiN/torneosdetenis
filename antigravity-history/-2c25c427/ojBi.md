# Tournament Refinements Implementation Plan

This plan addresses immediate rendering issues, match interactions, visual alignment, and consolation bracket logic.

## Proposed Changes

### [Component Name] [Tournament List (Admin)]
#### [MODIFY] [index.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/index.tsx)
- Import `useFocusEffect` from `expo-router`.
- Use `useFocusEffect` to call `loadTournaments()` whenever the screen is focused.

---

### [Component Name] [Tournament Details (Admin)]
#### [MODIFY] [[id].tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/[id].tsx)
- **Interaction**:
    - Split the match card into separate touchable areas for Player 1, Player 2, and the Scores.
    - Implement `handlePlayerPress(matchId, playerSlot)` to open a user search modal.
    - Implement `updateMatchPlayer(matchId, playerSlot, profileId)` to save the manually added player.
    - Add a `PlayerSelectModal` (reusing logic from `create.tsx`).
- **Layout**:
    - Adjust bracket rendering to use calculated gaps for better vertical centering.
    - Each round will have its matches spaced out by `(2^round - 1) * matchHeight`.
- **Consolation**:
    - Ensure the "Consolación" tab filters matches correctly (e.g., using a `is_consolation` flag or a specific `round_name` prefix).

---

### [Component Name] [Tournament Creation]
#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/create.tsx)
- **Consolation Logic**:
    - If "Consolación" format is selected, generate two separate sets of matches.
    - One set for the "Main" bracket.
    - One set for the "Consolation" bracket with appropriate scaffolding for losers.

## Verification Plan

### Manual Verification
1. **Refresh Logic**:
    - Create a tournament.
    - Verify it appears in the list immediately after the success modal closes.
2. **Bracket Interaction**:
    - Open a bracket.
    - Click "Por definir" and verify the player search modal opens.
    - Select a player and verify they are saved to that slot.
    - Click the score and verify the score modal opens.
3. **Bracket Layout**:
    - Create an 8-player tournament.
    - Verify Semifinals are centered between their Round 1 parents.
4. **Consolation Bracket**:
    - Create a "Consolación" tournament.
    - Verify the "Consolación" tab shows a separate bracket structure.
