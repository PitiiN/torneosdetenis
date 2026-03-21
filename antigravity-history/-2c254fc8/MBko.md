# Implementation Plan - Tournament UI Polishing & RR Fixes

This plan addresses several UI refinements requested by the user and fixes a critical bug in the Round Robin group display.

## Proposed Changes

### [Component] Tournament Scoring Modal

#### [MODIFY] [admin/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/%5Bid%5D.tsx)
- **Add Player Name Headers**: Above the set score inputs, add a row with the names of Player 1 and Player 2 centered over their respective columns.

### [Component] Tournament Brackets & Matches

#### [MODIFY] [admin/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/%5Bid%5D.tsx)
- **Show All Sets**: Update the match card rendering (both in bracket and list view) to iterate over all sets in the `score` string (e.g., "6-4 6-2") and display each set score in its own small box.

#### [MODIFY] [tabs/tournaments/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28tabs%29/tournaments/%5Bid%5D.tsx)
- **Show All Sets**: Apply the same multi-set display logic to the user view match cards.

### [Component] Round Robin Logic

#### [MODIFY] [admin/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/%5Bid%5D.tsx)
- **Fix Group Filtering**:
  - Filter the `matches` list shown for RR based on the `activeTab` (Group A vs Group B).
  - Update the "Tabla General" to show only players relevant to the active group.
  - Fix the group header title in the table to dynamically show "Grupo A" or "Grupo B".
- **Allow Player Selection**: Ensure `handlePlayerPress` works for RR matches so admins can assign players manually.

#### [MODIFY] [tabs/tournaments/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28tabs%29/tournaments/%5Bid%5D.tsx)
- **Fix Group Filtering**: Apply the same group filtering logic for RR matches and tables in the user view.

## Verification Plan

### Manual Verification
1. **Score Modal**:
   - Open the score editor for any match.
   - Verify names of both players are visible above the columns.
2. **Multi-set Display**:
   - Save a score like "6-4 6-7 7-6".
   - Verify that the bracket/match card shows all three set scores in sequence.
3. **Round Robin Tabs**:
   - Open an RR tournament with two groups.
   - Switch between "Grupo A" and "Grupo B".
   - Verify that the table title, player list, and list of matches update correctly for each group.
4. **RR Player Assignment**:
   - Attempt to assign a player to a "Por definir" slot in an RR match.
   - Verify the search and assignment works as expected.
