# Multi-Organization Refactor Implementation Plan

## Goal Description
Refactor the React Native app (Expo + TypeScript) to support multi-organization features. Ensure distinct workflows for Admins and Players, implement a ranking system, proper DB migrations with RLS, and a new UI/UX design (Deep Navy + Electric Blue + Neon Lime). **Note: Analysis shows most database and feature structural requirements are already fulfilled in the codebase.** The primary tasks remaining are refactoring the massive `AdminScreen.tsx`, adding the required unit tests, and verifying the application builds without type errors.

## User Review Required
Please review this updated plan. Since the database migrations and base screens were already implemented properly in the codebase, the execution phase will focus heavily on:
1. **Refactoring**: Breaking down `AdminScreen.tsx` (1700+ lines) into smaller sub-components (e.g. `TournamentWizard`).
2. **Quality Assurance**: Writing unit tests for specific logic (`generateCuadro`, RR Standings, ranking).
3. **Type Safety & Build**: Running `typecheck` and `build` and fixing any existing TypeScript or ESLint errors.

## Proposed Changes

### Component Refactoring
- **`src/screens/AdminScreen.tsx`**: Extract logic related to the Tournament Wizard and specific tournament management features into separate files under `src/ui/components` or new screens if necessary.
- **Theme check**: Audit `src/ui/components` to ensure the sport-tech theme is correctly applied everywhere as initially required.

### Testing & Validation
- **`tests/domain.test.mjs`** (or similar test files): Implement unit tests using Node's test runner for `generateCuadro`, Round Robin standings (`computeGroupStandings`), and ranking calculation rules.

## Verification Plan

### Automated Tests
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Manual Verification
- Deploy/simulate the app flow to verify the Admin Wizard still operates correctly after the refactor.
