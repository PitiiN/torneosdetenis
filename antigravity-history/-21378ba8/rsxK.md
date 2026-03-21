# Round 2 — 7 Fixes

- [x] **1. Avisos badge** — Replaced date logic with counter `seenAvisosCount`
- [x] **2. Audio stop on nav** — Uses `useFocusEffect` blur listener
- [x] **3. SOS auto-dial** — Added `CALL_PHONE` permission + `PermissionsAndroid`
- [x] **4. Accessibility global** — Removed "Modo simplificado", TTS toggle controls buttons, ♿→☉
- [x] **5. Password/email in-app** — Modal with `updateUser({ password })` directly
- [x] **6. Excel + selectors** — Fixed via `uint8ArrayToBase64`, separate Year/Month pills
- [x] **7. Notification badges** — Badges on Más items, Avisos tab, admin tabs. Replies blocked on Rechazada/Resuelta.
