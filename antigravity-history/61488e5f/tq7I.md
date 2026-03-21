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

## E) QA & Polish
- [x] Implement unit tests for `generateCuadro`
- [x] Implement unit tests for `standings RR`
- [x] Implement unit tests for `ranking calc`
- [x] Run `npm run typecheck`, `npm run test`, `npm run build` and fix any issues
- [x] Review and update `RUNBOOK.md` if necessary
