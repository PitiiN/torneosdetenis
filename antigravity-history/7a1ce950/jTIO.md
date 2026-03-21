# Multi-Organization Refactor Implementation Plan

## Goal Description
Refactor the React Native app (Expo + TypeScript) to support multi-organization features. Provide distinct workflows for Admins (manage an organization, create tournaments, approve payments) and Players (view an organization showcase, select an organization, and access its tournaments and notifications). Include a new ranking system by organization and category, proper DB migrations with RLS, and a new UI/UX design (Deep Navy + Electric Blue + Neon Lime).

## Missing Context & User Review Required
None identified yet. Let's establish the DB state first.

## Proposed Changes

### Database Migrations & RLS
- Create `organizations` table + relations.
- Initialize default organization for the existing admin.
- Create `notifications` and `notification_reads`.
- Create ranking tables (`ranking_points_rules`, `ranking_points_ledger`, `rankings`).
- Apply RLS policies restricting data by `org_id` (admin vs player views).

### Project Structure & Features
- Reorganize `src/` to follow feature-based structure (`auth`, `orgs`, `tournaments`, `admin`, `ranking`, `notifications`, `payments`, `profile`, `config`).
- RootNavigator and separated Stacks: AdminTabs vs PlayerFlow.

### UI/UX Refactor
- Centralize theming parameters.
- Create generic visual components.

## Verification Plan

### Automated Tests
- Run `npm run typecheck`, `npm run test`, `npm run build`.
- Write unit tests for `generateCuadro`, `RR standings`, and `ranking calc`.

### Manual Verification
- Deploy and verify standard workflows for Player.
- Deploy and verify standard workflows for Admin.
