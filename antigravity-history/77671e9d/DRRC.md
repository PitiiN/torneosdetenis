# Implementation Plan: Fix Tournament Creation Spinner

The goal is to resolve the infinite spinner issue during tournament creation and fix a critical bug where profile IDs were being used instead of tournament player IDs in match generation.

## User Review Required
> [!IMPORTANT]
> This change refactors how matches are generated to ensure they correctly link to the `tournament_players` table, which is required for the database to maintain referential integrity.

## Proposed Changes

### [Admin] Tournament Creation
#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/%28admin%29/tournaments/create.tsx)
- Add validation for `playersCount`.
- Wrap player insertion to handle empty arrays.
- Use `.select()` on player insertion to obtain the mapping from `profile_id` to `tournament_player_id`.
- Use the obtained mapping when generating matches to ensure `player1_id` and `player2_id` refer to the correct table.
- Improve error logging and ensure `setIsSubmitting(false)` is always reached.
- Fix Round Robin logic to support multiple groups if players > 8 (preparatory for future group logic).

## Verification Plan

### Manual Verification
1. Create a tournament with 8 players select manually.
2. Create a tournament using "Forzar Generación Incompleta" with 0 players.
3. Verify that the success modal appears in both cases.
4. Verify that generated matches in the detail view have the correct player names (or "Por definir").
5. Verify that the spinner disappears after completion or error.
