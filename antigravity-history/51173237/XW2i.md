# JJVV Mobile — 15 Bug Fixes & Improvements

15 items reported after APK install, organized into batches for efficient implementation.

## Proposed Changes

---

### Batch 1: Critical Crashes & Loading

#### [MODIFY] [RootNavigator.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/navigation/RootNavigator.tsx)
**Item 1 — Infinite loading on first open**: The `fetchMembershipData` call to Supabase's `memberships` table hangs on first cold start (no local cache). Add a **5-second timeout** to the auth loading state so the app renders even if Supabase is slow/unreachable.

#### [MODIFY] [NeighborhoodMapScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/NeighborhoodMapScreen.tsx)
**Item 2 — Map crashes app**: `react-native-maps` requires native module config that may crash on certain builds. Replace `MapView` with a **WebView** loading Google Maps embed. This is crash-proof and works in any environment.

---

### Batch 2: Notification Badges

#### [MODIFY] [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts)
**Items 3 & 11**: Add `seenAvisosDate` (last time user viewed avisos) to store. Badge count = important avisos created after that date.

#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx)
Update badge logic: when user taps "Avisos", mark all as seen. Badge = count of unseen important avisos.

#### [MODIFY] [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx)
On screen focus, call `markAvisosSeen()`.

---

### Batch 3: Audio & TTS

#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx)
**Item 4**: Add 🔊 button on each important aviso card using `expo-speech`.

#### [MODIFY] [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx)
**Item 5**: Add `useEffect(() => () => Speech.stop(), [])` cleanup on unmount.

---

### Batch 4: Emergency & Solicitudes

#### [MODIFY] [EmergencyScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EmergencyScreen.tsx)
**Item 6**: Already uses `Linking.openURL('tel:...')`. This does initiate a call on real devices. No change needed — will verify on device.

#### [MODIFY] [SolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/SolicitudesScreen.tsx)
**Item 7**: Add category picker above description field with options: "Accidente", "Certificado de Residencia", "Nuevo Servicio/Oficio/Emprendimiento", "Otro". Add `category` field to `Solicitud` type in store.

---

### Batch 5: Profile & Accessibility

#### [MODIFY] [ProfileScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/ProfileScreen.tsx)
**Item 8**: Add "Cambiar correo" button with modal/input. Uses `supabase.auth.updateUser({ email: newEmail })`.

#### [MODIFY] [AccessibilityContext.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/context/AccessibilityContext.tsx)
**Item 9**: Save settings to `AsyncStorage` instead of Supabase (no `profiles` table). Add `ttsEnabled` field.

#### [MODIFY] [AccessibilityScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AccessibilityScreen.tsx)
Wire to `AccessibilityContext` instead of local state. Change ♿ emoji to the **universal accessibility symbol** (☉). Make font scale preview update in real-time. Show high contrast preview.

---

### Batch 6: Admin Fixes

#### [MODIFY] [DashboardScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/DashboardScreen.tsx)
**Item 10**: Replace `${(totalIncome / 1000).toFixed(0)}K` with `formatCLP(totalIncome)`.

#### [NEW] [AdminSettingsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminSettingsScreen.tsx)
**Item 12**: Functional settings: edit organization name, address, phone, social media, view mode toggle. Persist to store.

#### [MODIFY] Admin navigation
**Item 13**: Add NeighborhoodMapScreen route to admin tabs/more stack.

---

### Batch 7: Solicitudes & Finance Filters

#### [MODIFY] [AdminSolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminSolicitudesScreen.tsx)
**Item 14**: Add month/year selector (horizontal scroll pills) to filter solicitudes by date.

#### [MODIFY] [AdminFinanceScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminFinanceScreen.tsx)
**Item 15a**: Allow reverting paid dues → add `onLongPress` to toggle back to `pending`.
**Item 15b**: Fix Excel Base64 error — ensure `buffer` package is properly imported and the `FileSystem` API call is correct.
**Item 15c**: Add month/year selector for finance period filtering.

---

## Verification Plan

### Local Testing (Expo Go)
- Open app first time → should render within 5 seconds
- Navigate to Mapa del Barrio → no crash
- Avisos badge → appears, disappears after opening Avisos
- Play audio in Avisos → leave section → audio stops
- SOS → tap number → phone dialer opens
- New Solicitud → category dropdown works
- Profile → change email → saves
- Accessibility → font size, contrast, etc. have visible effect
- Admin dashboard → CLP format, not K
- Admin solicitudes → month filter works
- Admin finance → reverse dues, Excel download, month filter
