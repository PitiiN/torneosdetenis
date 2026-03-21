# Implementation Plan - Admin Edit Class View Refinements

This plan addresses several UX improvements in the Admin Class detail/edit view.

## Proposed Changes

### UI Cleanup
- Remove the manual status selector ("Estado") as requested.

### Class Cancellation
- **Button**: A new button "Cancelar Clase" in the header.
- **Logic**: Confirm via Alert, then update the class status to 'cancelled'. This will trigger the application logic (or DB triggers) to notify students and handle credit returns.

### Manual Enrollment Enhancements
- **Search**: Ensure the student search is responsive (already implemented via `filteredStudents`).
- **Replication**: Integrate the "Replicar inscripción" switch and "Semanas adicionales" input into the `Add Student` modal.
- **Batch Processing**: When adding a student with replication enabled, use the same flexible validation and batch enrollment logic used in the Home screen.

## Verification Plan

### Manual Verification
- **Admin Edit View**: Verify "Estado" section is gone.
- **Cancellation**: Click "Cancelar Clase", confirm, and verify the class list/dashboard reflects the cancellation.
- **Student Replication**: manually add a student to a class and replicate it for 2 weeks. Verify they appear in the subsequent classes in the admin schedule.
