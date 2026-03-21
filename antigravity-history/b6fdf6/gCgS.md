# Implementation Plan: Fix Class Creation and Enrollment Errors

Address the specific error messages reported: class overlap conflict and duplicate enrollment record.

## User Review Required
> [!IMPORTANT]
> - These fixes are critical for system reliability.
> - The class creation logic now performs a more detailed overlap check to ensure no partial overlaps occur (e.g., mismatched start times).
> - The enrollment logic now correctly handles re-adding students by using `upsert` instead of `insert`.

## Proposed Changes

### [Component] Admin Class Creation (`app/(admin)/classes/create.tsx`)

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)
- Re-implement the conflict detection to perform a proper interval check instead of a simple `start_datetime` match.
- Query for all classes on the target court within the entire potential recurring date range and perform the overlap check in Javascript for total accuracy.

### [Component] Admin Edit Class (`app/(admin)/classes/[id].tsx`)

#### [MODIFY] [id.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/[id].tsx)
- Update the manual enrollment (single class case) to use `supabase.from('enrollments').upsert()` instead of `.insert()`.
- Ensure the re-activation of a 'cancelled' status works seamlessly by resetting `status` to 'confirmed' and clearing `cancelled_at`.

## Verification Plan

### Manual Verification
- **Overlapping Class Creation**: 
  - Intentionally create a class that partially overlaps with another (e.g. 15:00-16:00 vs 15:30-16:30 if possible, or same time).
  - Verify that the error is caught on the client side and the user is warned.
- **Repeat Enrollment**:
  - Enroll a student, remove them, then try to enroll them again.
  - Verify that the student is re-enrolled without "duplicate key" error.
