# Refactor Plan: Admin Home & Tournament Sorteo Flow

## Goal Description
The objective is to refine the Admin Home screen and the Tournament generation flow to better align with the actual operations workflow. 
Specifically:
1. Update `AdminHomeScreen` layout (adjust titles, remove redundant buttons).
2. Update `TournamentWizard` to only handle creation of the tournament structure without automatically assigning players or generating matches.
3. Update `AdminScreen` to remove redundant inline configuration inputs (as the wizard already captures them), and introduce a clear two-step flow: 
    - **Step 1:** View the empty structure. 
    - **Step 2:** Execute a "Sortear" (Draw) action to automatically assign players to groups/brackets and then generate the corresponding fixtures (matches).

## Proposed Changes

### 1. `src/screens/AdminHomeScreen.tsx`
- Change title "Operacion diaria" to "Gestion de Torneos".
- Remove the "Accesos rapidos" card entirely (with its 3 buttons).
- Keep the "+ Nuevo Campeonato" bottom-right FAB.

### 2. `src/ui/components/TournamentWizard.tsx`
- In Step 7, remove the helper "Nota" text.
- Change the final button text from "Generar SI O SI" to just "Generar".

### 3. `src/screens/AdminScreen.tsx`
- **Wizard Completion Logic**: When the wizard finishes, it should create the `tournaments` and `categories` rows, and for the selected format:
  - **Round Robin**: Only create the empty `rr_groups`. Do NOT create `matches`.
  - **Elimination**: Only create the empty `matches` for the bracket.
- **Remove Redundant UI**: Remove the manual inputs in the main Admin view that duplicate the Wizard's configuration steps (Format, Size, etc.). The AdminScreen should simply read this from the `draws` and `categories` records.
- **New Action - "Sorteo"**: Add a clear "Sortear" button for when a tournament is in its initial state. This button will:
  - Fetch active participants.
  - Automatically distribute them to groups or bracket slots.
  - Generate the corresponding matches (for RR and ELIM).
- **Match Editing**: The ability to manually assign/edit players in groups and fixtures must be preserved.

## Verification Plan
- Create a new tournament using the wizard.
- Verify it creates empty groups or an empty bracket tree.
- Manually trigger the "Sortear" button and ensure players are distributed correctly and matches are populated.
