# Implementation Plan: Class Management Refinements Phase 2

Refine the class creation process to handle conflicts gracefully, improve coach selection, and optimize student search in the admin interface.

## Proposed Changes

### [Component] Admin Class Creation (`app/(admin)/classes/create.tsx`)

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)
- Update `handleSubmit` to identify specific dates with conflicts.
- If conflicts exist, show a confirmation alert allowing the user to create ONLY the available (non-conflicting) classes.
- Update the coach selection UI to allow deselecting or changing the coach.

### [Component] Admin Edit Class (`app/(admin)/classes/[id].tsx`)

#### [MODIFY] [id.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/[id].tsx)
- Update the "Add Student" modal logic to hide the student list initially.
- Only display results when the `studentSearch` input has at least 2-3 characters (or any input as requested).
- Ensure the search list is filtered correctly.

## Verification Plan

### Manual Verification
- **Partial Class Creation**:
  - Try to create a recurring class where some weeks are already occupied.
  - Verify that the system warns about the specific dates and asks if you want to proceed with the remaining ones.
  - Confirm only the non-conflicting classes are inserted.
- **Coach Selection**:
  - Verify that the coach can be changed or removed in the creation form.
- **Student Search**:
  - Open the "Add Student" modal.
  - Verify that the list is empty initially.
  - Verify that results appear as you type.
