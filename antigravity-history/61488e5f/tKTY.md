# Multi-Organization Refactor Task List

## A) DB & Migrations (Multi-org)
- [ ] Create `organizations` table + RLS policies
- [ ] Alter `profiles` to include `org_id` + RLS updates
- [ ] Create migration for `notifications` and `notification_reads` + RLS
- [ ] Create migration for `ranking_points_rules`, `ranking_points_ledger`, `rankings` + RLS
- [ ] Adjust `payment_proofs` / `registrations` tables if needed + RLS
- [ ] Add Seeder for initial organization assigned to existing admin

## B) UI/UX Base & Theme
- [ ] Create/Update base UI components (Screen, Header, Button, Card, Input, Badge, EmptyState)
- [ ] Implement Deep Navy + Electric Blue + Neon Lime theme

## C) Navigation & Routing Structure
- [ ] RootNavigator setup
- [ ] Admin Tabs (Home, Tornaments, Requests/Payments, Notifications, Config)
- [ ] Player Flow (OrgSelector -> PlayerTabs)

## D) Features: Player
- [ ] Showcase / Organization Selector (Vitrina)
- [ ] Player Home & Tournament Registration (with Payment Proof upload)
- [ ] Player Notifications
- [ ] Player Config & Profile edit

## E) Features: Admin
- [ ] Admin Home (quick actions)
- [ ] New Tournament Wizard (multi-step form)
- [ ] Tournament Management (Draws, Matches)
- [ ] Requests/Payments Approval
- [ ] Send Notifications
- [ ] Config: Edit Club Name, Player Search & Edit

## F) Ranking System
- [ ] Ranking logic calculation triggered by tournament close
- [ ] Admin manual adjustments UI
- [ ] Player Ranking view

## G) QA & Polish
- [ ] Add unit tests for `generateCuadro`, RR standings, ranking calc
- [ ] Verify `npm run typecheck`, `test`, `build`
- [ ] Update RUNBOOK.md
