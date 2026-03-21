# Tournament Refactor Task List

- [x] Fix immediate rendering of new tournaments in the list
- [x] Refactor match interaction in `TournamentDetails` (Admin)
- [/] Fix bracket visual alignment and syncing
    - [x] Admin view: Center matches between parents
    - [ ] Admin view: Reposition 3rd place match (pull up)
    - [ ] User view: Sync exactly with admin layout (replace old logic)
- [/] Implement true Consolation Bracket logic
    - [x] Update generation logic in `create.tsx`
    - [ ] Verify why some consolation brackets appear empty (debugging)
- [ ] Multi-set Score Input
    - [ ] Update score modal to show multiple sets based on tournament config
    - [ ] Ensure aggregate score is saved correctly
