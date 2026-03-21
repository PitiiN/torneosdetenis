# Multi-Organization Refactor Task List

## A) DB & Migrations (Multi-org)
- [x] Verify existing migrations for `organizations`, `notifications`, `rankings` and related RLS.
- [x] Verify seeder for initial organization assigned to existing admin.

## B) Navigation & Routing Structure
- [x] Verify RootNavigator setup (AdminTabs vs PlayerFlow)
- [x] Verify Player Flow (OrgSelector -> PlayerTabs)

## C) UI/UX Base & Theme
- [x] Verify `theme.ts` implements Deep Navy + Electric Blue + Neon Lime
- [ ] Ensure components consistently use the theme across all screens

## D) Features Refactoring
- [x] Refactor `AdminScreen.tsx` into smaller manageable components:
  - [x] Extract `TournamentWizard` to separate component/screen
  - [x] Extract match/draw management to separate views
- [x] Verify Admin Config (Club Name edit, Player Search & Edit)
- [x] Verify Requests/Payments Approval
- [x] Verify Player Showcase / Organization Selector (Vitrina)
- [x] Verify Ranking View
- [x] Verify Notifications

## E) Bugfixes & Stability
- [x] Fix App.tsx `INITIAL_SESSION` race condition causing startup Timeout
- [x] Wipe all tournaments from the system. (Pending user action via Dashboard)

## F) Sorteo and Admin Home Refactor
- [x] Refactor `AdminHomeScreen.tsx` text and layout.
- [x] Refactor `TournamentWizard.tsx` to generate empty brackets/groups without assignments.
- [x] Refactor `AdminScreen.tsx` to remove the redundant form block.
- [x] Add `Sorteo` action in `AdminScreen.tsx` to assign players to the generated empty fixtures.

## G) QA & Polish
- [x] Implement unit tests for `generateCuadro`
- [x] Implement unit tests for `standings RR`
- [x] Implement unit tests for `ranking calc`
- [x] Run `npm run typecheck`, `npm run test`, `npm run build` and fix any issues
- [x] Review and update `RUNBOOK.md` if necessary

## H) Admin Master-Detail and Empty RR Slots Refactor
- [x] User runs raw SQL snippet in Supabase to fix `categories` and `rr_group_members`.
- [x] Refactor `AdminScreen.tsx` to display a clean list of Tournaments (Master View).
- [x] Render Detail View when a Tournament is selected.
- [x] Update `finishTournamentWizard` to insert empty `rr_group_members` for Round Robin visualizations.
- [x] Update `PlayerAssignModal` to support assigning players directly to empty `rr_group_members` blocks.
- [x] Support manual text names for unregistered players in groups and matches.
- [x] Sync group member assignment changes predictably to already generated RR matches.

## I) Match Scheduling & Editor Refactor
- [x] Implement per-match Court and Time scheduling.
- [x] Consolidate Match Score Editing and Scheduling into a single `MatchEditModal`.
- [x] Fix 'TBD vs TBD' in Match Editor to correctly display manual names.
- [x] Ensure winner dropdown in Match Editor shows manual names if available.
- [x] Restructure Match cards in Admin Screen to a 2-column square grid for better screen usage.
- [x] Order the generated RR matches by Group Name instead of randomly.
