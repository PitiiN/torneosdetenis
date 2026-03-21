# Tournament Refactor Task List

- [ ] Fix immediate rendering of new tournaments in the list
    - [x] Use `useFocusEffect` to reload in `AdminTournamentsScreen`
- [ ] Refactor match interaction in `TournamentDetails` (Admin)
    - [ ] Split match card into "Player Selection" and "Score Entry" hit areas
    - [ ] Implement player selection popup for "Por definir" slots (Admin only)
- [ ] Fix bracket visual alignment
    - [ ] Center matches of subsequent rounds between their previous round parents
- [ ] Implement true Consolation Bracket logic
    - [ ] Update generation logic in `create.tsx` for loser scaffolding
    - [ ] Ensure `Consolacion` tab displays its own matches correctly
