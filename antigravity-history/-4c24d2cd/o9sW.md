# Task: Bug Fix Phase 2

- [x] Research and fix infinite loading bug in `app/_layout.tsx`
- [x] Update "Arriendo de Canchas" message in `app/selection.tsx`
- [x] Improve day selector scrolling in all views (User/Admin)
- [x] Fix profile phone persistence and navigation in `app/(tabs)/profile.tsx`
- [x] Verify all fixes

# Task: Bug Fix Phase 3
- [x] Fix `useAuthStore` import error in `app/(tabs)/profile.tsx`
- [x] Debug and fix day selector scrolling (User/Admin)
- [x] Implement 24h cancellation rule for students
- [x] Verify all Phase 3 fixes

# Task: Bug Fix Phase 4
- [x] Remove Admin bypass in `my-classes.tsx` (enforce 24h rule)
- [x] Refine and stabilize day selector scrolling (User/Admin)
- [x] Verify Phase 4 fixes

# Task: Recurring Enrollment
- [x] Research credit and enrollment system
- [x] Extend `enrollmentsService` with flexible validation
- [x] Implement UI in `index.tsx` with themed conflict resolution
- [x] Refine Alert UI (capitalization & centering)
- [x] Verify partial enrollment and credit recalculation <!-- id: 42 -->

# Task: Admin Create Class Enhancements
- [x] Implement automatic scrolling for time blocks
- [x] Fix bottom safe area/padding for phone buttons
- [x] Add cancel button next to "Crear Clase"
- [x] Implement recurring class creation logic <!-- id: 46 -->

# Task: Admin Edit Class Refinements
- [x] Remove State selection in Edit Class
- [x] Add Cancel Class button with credit recovery
- [x] Implement recurring manual enrollment with replication logic <!-- id: 49 -->

# Task: Class Deletion & Search Fixes
- [x] Implement Conflict Detection for Recurring Classes (`app/(admin)/classes/create.tsx`)
- [x] Fix Student Search to include "admin" and "coach" roles (`app/(admin)/classes/[id].tsx`)
- [x] Refine Coach Selection logic (`app/(admin)/classes/[id].tsx`)
- [x] Ensure deleted classes do not appear as "Blocked" slots
- [x] Ensure deleted classes are removed from restricted slots
