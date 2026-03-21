# Implementation Plan - Conflicts, Search, and Coach Selection

This plan addresses three specific issues in the Admin class management.

## Proposed Changes

### app/(admin)/classes/create.tsx
- [MODIFY] update `handleSubmit` to check for existing classes on the target dates/times before proceeding with insertion.

### app/(admin)/classes/[id].tsx
- [MODIFY] update `openAddStudent` to query profiles with `role` in `['student', 'admin', 'coach']` to match the user's expectations.
- [MODIFY] Ensure `handleSave` correctly uses the `selectedCoach?.id`.

## Verification Plan

### Manual Verification
- **Conflicts**: create a class for today at 3pm, then try to create another one (or a recurring one) that covers today at 3pm. Verify the conflict is reported.
- **Search**: search for "Javier Aravena" and verify he appears in the list.
- **Coach**: change the coach from "Coach A" to "Coach B", save, and re-open the class to see if "Coach B" is still selected.
