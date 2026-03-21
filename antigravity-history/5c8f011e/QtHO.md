# Implementation Plan - Recurring Enrollment

This plan implements a feature allowing students to replicate a class enrollment for X future weeks, with credit validation and atomic behavior (Option A: all or none).

## Proposed Changes

### 1. Enrollment Service Update
- **File**: `src/services/enrollments.service.ts`
- **Action**:
  - Add `enrollRecurring` function to handle the batch enrollment logic.
  - Use `supabase.rpc('get_student_class_allowance')` for credit validation.
  - Loop through future weeks to find matching classes and validate availability.
  - Implement atomic check before performing inserts.

### 2. Home Screen UI Improvements
- **File**: `app/(tabs)/index.tsx`
- **Action**:
  - Add `recurringEnabled` (toggle) and `replicationCount` (number input) to the enrollment modal.
  - Style the new inputs to match the existing dark/glassmorphism theme.
  - Update `handleEnroll` to call the recurring service if enabled.

### 3. Verification & Polish
- Ensure the allowance/credits refresh properly after enrollment.
- Ensure the modal reset states correctly when closed.

## Verification Plan

### Manual Verification
- **Success Case**: Enroll for 1 current class + 2 replications. Verify "Mis Clases" shows all 3 and "Pagos" shows 3 credits used.
- **Credit Limit**: Attempt to enroll for 5 weeks with only 2 credits. Verify the system blocks the action with a clear alert.
- **Availability Block**: Find a future slot where a class is full or missing and attempt to replicate into it. Verify the entire operation is blocked to prevent partial enrollments.
- **Input Validation**: Try entering negative numbers or text in the weeks input. Verify it's blocked.
