# Implementation Plan - Tournaments Module

This plan details the implementation of the new Tournaments module based on the provided UI designs. It covers Database Schema, Admin functionalities (Create/Manage), and User functionalities (Read-only viewing).

## 1. Database Schema Additions

A new migration will be created to support tournament logic.

### Tables
1. **`tournaments`**: 
   - `id` (uuid, PK)
   - `name` (text, e.g., "Categoría A")
   - `modality` (text: 'singles', 'dobles')
   - `category` (text: 'cat-a', 'cat-b', 'cat-c', 'open')
   - `format` (text: 'eliminacion', 'round-robin', 'consolacion')
   - `set_type` (text: 'best3', 'short4', 'tb10')
   - `status` (text: 'draft', 'in_progress', 'completed')
   - `start_date` (date)
   - `created_at`

2. **`tournament_players`**:
   - `id` (uuid, PK)
   - `tournament_id` (uuid, FK)
   - `profile_id` (uuid, FK - references profiles, since they must be registered users)
   - `group_name` (text, nullable - for Round Robin: 'A', 'B')
   - `seed` (int, nullable - for Elimination positional seeding)
   - `points` (int, for Round Robin standings)
   - `matches_played`, `matches_won`, `matches_lost` 

3. **`tournament_matches`**:
   - `id` (uuid, PK)
   - `tournament_id` (uuid, FK)
   - `player1_id` (uuid, FK to `tournament_players`, nullable)
   - `player2_id` (uuid, FK to `tournament_players`, nullable)
   - `winner_id` (uuid, FK to `tournament_players`, nullable)
   - `round_name` (text, e.g., "Cuartos", "Semi", "Final", "Grupo A - R1")
   - `match_order` (int, for bracket positioning)
   - `score` (text, e.g., "6-4 6-2")
   - `schedule_time` (timestamp, nullable)

### RLS Policies
- `tournaments`, `tournament_players`, `tournament_matches`:
  - `SELECT`: Authenticaded users.
  - `INSERT`, `UPDATE`, `DELETE`: Only `admin` role.

## 2. Admin UI (`app/(admin)/tournaments/`)

The Admin area will have full control to generate and edit.

### [MODIFY] `app/(admin)/tournaments.tsx`
- Refactor the current placeholder to show a list of ongoing/past tournaments.
- Add a FAB (Floating Action Button) to navigate to `app/(admin)/tournaments/create`.

### [NEW] `app/(admin)/tournaments/create.tsx`
- **View 1 (Generación de Cuadro)**.
- Form to define: Name, Modality, Category, Format, Set Type.
- Dynamic list of players: Combobox/Search to add students from `profiles`.
- A "Generar Cuadro/Torneo" button that creates the Tournament, Players, and empty Matches in the database, then redirects to the Details View.

### [NEW] `app/(admin)/tournaments/[id].tsx`
- A consolidated detail view that relies on the `format` of the tournament.
- **If `eliminacion` or `consolacion`:**
  - Standard Bracket view using **View 2** (Cuadro Principal) and **View 3** (Cuadro de Consolación tabs).
  - Admins can tap on a match to open a modal and input the score/winner.
- **If `round-robin`:**
  - Uses **View 4** (Tablas y Próximos Partidos) and **View 5** (Llaves Posteriores).
  - Admins can toggle between Group A / Group B tabs.
  - Admins can edit match results, which automatically updates the Standings table.

## 3. User UI (`app/(tabs)/tournaments.tsx`)

The User area mirrors the Admin area visually but securely limits interactivity.

### [MODIFY] `app/(tabs)/tournaments.tsx`
- Refactor placeholder to list all active and past tournaments.

### [NEW] `app/(tabs)/tournaments/[id].tsx`
- Shows **exactly the same visual structures** (Brackets, Tables) as the Admin view.
- **Differences:**
  - Removed "Edit" / "Add Score" modals.
  - No FAB to add/edit.

## Verification Plan
1. **Database**: Run migration, check tables and RLS. Ensure `Admin` can edit, `Student` can only read.
2. **Admin Create**: Verify the Form captures all players and correctly scaffolds DB rows for matches depending on the format.
3. **Admin Edit Match**: Add a score to a Quarter Final match; verify the victor advances to Semi Finals.
4. **User View**: Verify the user sees the updated bracket but clicking on a match does nothing.
