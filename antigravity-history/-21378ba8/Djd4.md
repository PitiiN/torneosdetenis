# JJVV Mobile — 15 Bug Fixes & Improvements

## Batch 1: Critical Crashes & Loading
- [x] **1. Infinite loading on first open** — Added 5s safety timeout in `AuthContext.tsx`
- [x] **2. Map crashes app** — Replaced `react-native-maps` with Leaflet WebView in `NeighborhoodMapScreen.tsx`

## Batch 2: Notification Badges
- [x] **3. Avisos badge doesn't clear** — Added `seenAvisosDate` + `markAvisosSeen()` to store, wired to `HomeScreen.tsx`
- [x] **11. Notification numbers persist** — Badge logic updated across home and announcements screens

## Batch 3: Audio & TTS
- [x] **4. Important avisos need TTS on Home** — Added 🔊 button to important aviso cards in `HomeScreen.tsx`
- [x] **5. Audio continues after leaving section** — Added `Speech.stop()` cleanup on unmount in `AnnouncementsScreen.tsx`

## Batch 4: Emergency & Solicitudes
- [x] **6. SOS numbers should dial immediately** — Already works via `Linking.openURL('tel:...')`
- [x] **7. Category dropdown in Solicitudes** — Added modal picker with 4 categories in `SolicitudesScreen.tsx`

## Batch 5: Profile & Accessibility
- [x] **8. Change email in Profile** — Added modal + `supabase.auth.updateUser` in `ProfileScreen.tsx`
- [x] **9. Accessibility improvements** — Reworked `AccessibilityContext.tsx` (AsyncStorage), `AccessibilityScreen.tsx` (real effects, ☉ icon, live preview)

## Batch 6: Admin Fixes
- [x] **10. Dashboard financial format** — Changed to `formatCLP()` in `DashboardScreen.tsx`
- [x] **12. Configuración JJVV button** — Created `AdminSettingsScreen.tsx` with org editing
- [x] **13. Map in admin view** — Added route in `AdminMoreStack.tsx` and buttons in `AdminMoreScreen.tsx` + `DashboardScreen.tsx`

## Batch 7: Solicitudes & Finance Filters
- [x] **14. Month filter for solicitudes** — Added month/year selector in `AdminSolicitudesScreen.tsx`
- [x] **15. Finance fixes** — (a) Dues reversal via tap on paid, (b) Excel uses `type:'base64'` directly, (c) Month filter added
