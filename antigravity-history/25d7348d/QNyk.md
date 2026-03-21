# Tournament Fixes & Refinements Plan

Addressing score display issues, player management, and consolation bracket structure.

## Proposed Changes

### [Component Name] [Tournament Details (Admin)]
#### [MODIFY] [[id].tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/[id].tsx)
- **Score Display**:
    - Update `split(' ')` to `replace('-', ' ').split(' ')` or similar to handle "6-1" format.
    - Improve score logic to handle cases like "6-1 6-2" (sets).
- **Player Removal**:
    - Add a "Clear Player" option in the `PlayerSelectModal` or a long press action on the player name.
    - Implement `removeMatchPlayer(matchId, slot)` to set the player ID to null.
- **Score Modal**:
    - Update `TextInput` style to use `colors.text` to ensure visibility.

### [Component Name] [Tournament Creation]
#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/tournaments/create.tsx)
- **Consolation Structure**:
    - Ensure that for any $N$ players, the consolation bracket starts with $N/2$ participants (the losers of Round 1).
    - If $N=8$, Round 1 has 4 losers. Consolation starts at Semifinals (4 players).

## Verification Plan

### Manual Verification
1. **Score Split**:
    - Enter "6-4" as a result.
    - Verify "6" appears next to Player 1 and "4" next to Player 2.
2. **Modal Visibility**:
    - Open score modal and type. Verify text is clearly visible.
3. **Player Removal**:
    - Click a player name, select "Eliminar" (or similar), and verify the slot becomes "Por definir".
4. **Consolation Generation**:
    - Create a 16-player tournament with consolation.
    - Verify the "Consolación" tab shows a bracket starting from Quarterfinals (8 players).
