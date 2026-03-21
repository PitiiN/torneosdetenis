# JJVV Mobile — 15 Bug Fixes & Improvements

## Batch 1: Critical Crashes & Loading
- [ ] **1. Infinite loading on first open** — `RootNavigator.tsx` / `AuthContext.tsx`: Add timeout fallback for `fetchMembershipData` Supabase call (likely failing silently on first cold start)
- [ ] **2. Map crashes app** — `NeighborhoodMapScreen.tsx`: `react-native-maps` may not work in Expo Go / standalone builds without native config. Replace with WebView-based map or wrap in error boundary

## Batch 2: Notification Badges
- [ ] **3. Avisos badge doesn't clear** — `HomeScreen.tsx`: Badge uses `importantAvisos.length` which never changes. Add `seenAvisos` tracking to store
- [ ] **11. Notification numbers persist** — Review all badge logic across admin/user tabs

## Batch 3: Audio & TTS
- [ ] **4. Important avisos need TTS on Home** — `HomeScreen.tsx`: Add 🔊 button to important aviso cards
- [ ] **5. Audio continues after leaving section** — `AnnouncementsScreen.tsx`: Add `useEffect` cleanup calling `Speech.stop()` on unmount

## Batch 4: Emergency & Solicitudes
- [ ] **6. SOS numbers should dial immediately** — `EmergencyScreen.tsx`: Already uses `Linking.openURL('tel:...')` — verify it works (should dial on real devices)
- [ ] **7. Category dropdown in Solicitudes** — `SolicitudesScreen.tsx`: Add picker with "Accidente", "Certificado de Residencia", "Nuevo Servicio/Oficio/Emprendimiento", "Otro"

## Batch 5: Profile & Accessibility
- [ ] **8. Change email in Profile** — `ProfileScreen.tsx`: Add email change form using `supabase.auth.updateUser({ email })`
- [ ] **9. Accessibility improvements** — `AccessibilityScreen.tsx` + `AccessibilityContext.tsx`: Wire context to screen, make font scale apply globally, implement high contrast/simple mode effects, change icon from ♿ to new universal symbol ☉

## Batch 6: Admin Fixes
- [ ] **10. Dashboard financial format** — `DashboardScreen.tsx`: Replace `K` format with `formatCLP()`
- [ ] **12. Configuración JJVV button** — `AdminMoreScreen.tsx`: Add functional settings (edit JJVV name, address, phone, social media links)
- [ ] **13. Map in admin view** — Add NeighborhoodMapScreen to admin navigation

## Batch 7: Solicitudes & Finance Filters
- [ ] **14. Month filter for solicitudes** — `AdminSolicitudesScreen.tsx`: Add month/year selector to filter list
- [ ] **15. Finance fixes** — `AdminFinanceScreen.tsx`: (a) Allow reverting paid dues to pending, (b) Fix Excel Base64 error, (c) Add month selector for finance period filtering
