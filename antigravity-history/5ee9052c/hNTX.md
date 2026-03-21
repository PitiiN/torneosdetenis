# Implementation Plan - Class Deletion & Search Fixes

This plan addresses the issue where cancelled classes remain in the schedule as "Blocked" and improves student search reliability.

## Proposed Changes

### 1. Physical Class Deletion
- **Location**: `app/(admin)/classes/[id].tsx`
- **Action**: Change `handleCancelClass` to physically delete the record from Supabase.
- **Credit Recovery**: Ensure `enrollments` are updated to `status: 'cancelled'` *before* the class is deleted (or rely on DB triggers if they handle it). 
- **Notification**: Keep the notification logic for students before deletion.

### 2. Dashboard Cleanup
- **Location**: `app/(admin)/dashboard.tsx`
- **Action**: The current logic already shows `hourBlockEmpty` if `hasClass` is false. By deleting the class, `hasClass` will be false, liberation of the slot will be "absolute" as requested.

### 3. Student Search Enhancements
- **Location**: `app/(admin)/classes/[id].tsx`
- **Search Logic**: Update the local filter to match against both `full_name` and `email`.
- **Fetching**: Use a more robust fetch (maybe larger limit or dedicated RPC if needed) to ensure the requested student is found.

## Verification Plan

### Manual Verification
- **Class Deletion**: 
    1. Create a class.
    2. Go to edit view.
    3. Click the delete (trash) button.
    4. Confirm.
    5. Verify the slot is completely empty in the dashboard (same color as other empty slots).
- **Student Search**:
    1. Open "Add Student" modal.
    2. Type an email address of a student.
    3. Verify they appear in the results.
