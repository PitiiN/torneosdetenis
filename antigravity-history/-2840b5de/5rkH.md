# Implementation Plan - Flexible Recurring Enrollment

This plan transitions the recurring enrollment flow to a flexible model where conflicts are reported and the user can choose to proceed with only available slots.

## Proposed Changes

### 1. Enrollment Service Enhancements
- **File**: `src/services/enrollments.service.ts`
- **Action**:
  - Add `validateRecurringEnrollment`: a "dry-run" method that identifies available slots and conflicts.
  - Returns: `{ available: Class[], conflicts: { date: Date, reason: string }[], remaining: number }`.

### 2. Home Screen Logic
- **File**: `app/(tabs)/index.tsx`
- **Action**:
  - Update `handleEnroll` to use the validation logic first.
  - Show a consolidated Alert if conflicts are found.
  - Recalculate credit requirements based on the final list of classes to enroll.

## Verification Plan

### Manual Verification
- **Conflict Handling**: Try to replicate 3 times where the second week is full. Verify the Alert shows "Semana 2: No hay cupos" and offers to enroll in the other 3 (current + weeks 1 & 3).
- **Credit Sync**: Verify that if only 2 out of 4 classes are enrolled, only 2 credits are deducted (via monthly used_classes sync).
