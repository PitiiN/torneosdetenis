# Phase 13: Fixing Regressions and Timezone Issues

## UI & Logic Fixes
- [/] **Blocked Slots**: Ensure only "Bloqueado" is shown for cancelled slots, hiding class info.
- [ ] **Next Class Sync**: Fix "Next Class" logic in `my-classes.tsx` to show the closest upcoming class or empty state.
- [ ] **Price Settings**: Fix infinite loading in `config.tsx`.
- [ ] **Admin Transitions**: Final fix for the white flicker.

## Functionality & Persistence
- [/] **Timezone Fix**: Ensure classes are saved and displayed at the correct local hour (fix 3-hour shift).
- [ ] **Payment Upload**: Fix "Cannot read property base64 of undefined" error.
- [ ] **Student Search**: Fix search logic in `students.tsx`.
