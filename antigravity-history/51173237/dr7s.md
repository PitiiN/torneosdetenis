# Round 2 — 7 Issues Fix Plan

## 1. Avisos badge doesn't clear

**Root cause**: Badge compares dates using `new Date("28 Feb 2026")` vs ISO string — unreliable parsing.  
**Fix**: Replace date-based logic with a simple counter. Store `seenAvisosCount` (total avisos seen). Badge = `announcements.length - seenAvisosCount`.

#### [MODIFY] [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts) — Replace `seenAvisosDate` with `seenAvisosCount`
#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx) — Badge = `announcements.length - seenAvisosCount`

---

## 2. Audio doesn't stop on section change

**Root cause**: Tab navigator keeps screens mounted, so `useEffect` cleanup never fires.  
**Fix**: Use `useFocusEffect` from React Navigation — call `Speech.stop()` on **blur** (losing focus).

#### [MODIFY] [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx) — Add blur listener
#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx) — Add blur listener to stop speech

---

## 3. Emergency calls need auto-dial

**Root cause**: `tel:` just opens the dialer. On Android, you need the **CALL_PHONE** permission + `intent://` to auto-call.  
**Fix**: Add `CALL_PHONE` permission to `app.json`, use `expo-intent-launcher` to launch `ACTION_CALL` intent on Android. This dials immediately without user pressing "call".

#### [MODIFY] [app.json](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/app.json) — Add `android.permissions: ["CALL_PHONE"]`
#### [MODIFY] [EmergencyScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EmergencyScreen.tsx) — Use `expo-intent-launcher` for direct calls

> [!WARNING]
> Auto-dialing requires the `CALL_PHONE` permission which Android will prompt the user to accept once. After that, calls will be instant. This requires a **new APK build** since permissions are set at compile time.

---

## 4. Accessibility: global effect, remove "Modo simplificado", fix TTS toggle

**Fix**:
- Wrap all text components in a global style that applies `fontScale` and `highContrast` from context.
- Remove "Modo simplificado" from AccessibilityScreen.
- Make TTS toggle actually disable/enable the 🔊 buttons in AnnouncementsScreen and HomeScreen.
- Change ♿ to ☉ in MoreScreen menu items.

#### [MODIFY] [App.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/App.tsx) — Apply global `Text.defaultProps.style` based on AccessibilityContext
#### [MODIFY] [AccessibilityScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AccessibilityScreen.tsx) — Remove "Modo simplificado"
#### [MODIFY] [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx) — Hide TTS buttons if `ttsEnabled === false`
#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx) — Same
#### [MODIFY] [MoreScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/MoreScreen.tsx) — Change ♿ to ☉

---

## 5. Password & email change in-app (no external links)

**Fix**: Replace `resetPasswordForEmail` (sends link) with `supabase.auth.updateUser({ password })` which changes password directly if the user is logged in. Same for email — already using `updateUser` but need to ensure it works without confirmation redirect.

#### [MODIFY] [ProfileScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/ProfileScreen.tsx) — In-app password change: old + new password fields + `updateUser({ password })`

---

## 6. Excel error persists + separate year/month selectors

**Root cause**: `xlsx` package's `type: 'base64'` might still fail in React Native. 
**Fix**: Use `type: 'array'` + manual base64 conversion, or ensure `buffer` polyfill works. Also separate year selector from month selector (two dropdowns).

#### [MODIFY] [AdminFinanceScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminFinanceScreen.tsx) — Fix Excel export, add separate year/month selectors
#### [MODIFY] [AdminSolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminSolicitudesScreen.tsx) — Same: separate year/month selectors

---

## 7. Notification badges on Más menu items + admin notifications

**Fix**:
- **MoreScreen**: Show badge count next to "Mis Solicitudes" (unseen) and "Documentos" (new docs since last seen).
- **Admin**: Show badge count on solicitudes tab for unseen-by-admin solicitudes. Block new messages if solicitud is Rechazada/Resuelta.

#### [MODIFY] [MoreScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/MoreScreen.tsx) — Badge counts on menu items
#### [MODIFY] [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts) — Add `seenDocsCount` for document badges
#### [MODIFY] [AdminTabs.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/navigation/AdminTabs.tsx) — Show badge on solicitudes tab
#### [MODIFY] [SolicitudDetailScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/shared/SolicitudDetailScreen.tsx) — Block replies if Rechazada/Resuelta

---

## Verification
- Badge clears on Avisos after opening
- Audio stops when changing tabs
- Emergency call happens with one tap (after permission granted)
- Font size/contrast applies globally across all screens
- Password/email changed in-app without external links
- Excel downloads successfully
- Year and month selectors are separate
- Notifications show on Más menu items and admin tabs
