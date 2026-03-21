# Walkthrough — Round 2 Fixes (7 issues)

## Files Modified (12 total)

| # | File | Changes |
|---|------|---------|
| 1 | [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts) | `seenAvisosCount` + `seenDocsCount` (counters), `markDocsSeen()`, storage v4 |
| 2 | [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx) | Counter badge, blur audio stop, TTS gate, Docs badge in quick actions |
| 3 | [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx) | `useFocusEffect` blur to stop audio, TTS toggle |
| 4 | [EmergencyScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EmergencyScreen.tsx) | `PermissionsAndroid.CALL_PHONE` auto-dial |
| 5 | [app.json](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/app.json) | Added `CALL_PHONE` permission |
| 6 | [AccessibilityScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AccessibilityScreen.tsx) | Removed "Modo simplificado" |
| 7 | [App.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/App.tsx) | Added `AccessibilityWrapper` for global effects |
| 8 | [MoreScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/MoreScreen.tsx) | Badges on Solicitudes/Docs, ♿→☉, markDocsSeen |
| 9 | [ProfileScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/ProfileScreen.tsx) | In-app password change modal (no external email) |
| 10 | [AdminFinanceScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminFinanceScreen.tsx) | `uint8ArrayToBase64` Excel fix, separate Year/Month pills |
| 11 | [AdminSolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminSolicitudesScreen.tsx) | Separate Year/Month pills |
| 12 | [SolicitudDetailScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/shared/SolicitudDetailScreen.tsx) | Blocked replies on Rechazada/Resuelta |
| 13 | [UserTabs.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/navigation/UserTabs.tsx) | Badge on Avisos tab + combined Más badge |

## Key Technical Decisions

- **Badge counter**: Replaced unreliable `new Date(localizedString)` parsing with simple `announcements.length - seenCount`
- **Audio stop**: `useEffect` cleanup doesn't fire in tab navigators. `useFocusEffect` blur callback solves this
- **Auto-call**: Uses `PermissionsAndroid.request(CALL_PHONE)` — requires rebuild
- **Excel**: `xlsx` `type:'base64'` fails in RN. Used `type:'array'` + manual `uint8ArrayToBase64()`

> [!WARNING]
> La función de auto-llamada (SOS) requiere un **nuevo build del APK** ya que el permiso `CALL_PHONE` se define en compilación. Si pruebas en Expo Go, solo abrirá el marcador normalmente.
