# Walkthrough — Round 3 Fixes (5 issues)

## Changes Summary

| # | Fix | Files | Key Change |
|---|-----|-------|------------|
| 1 | Phone calls | [EmergencyScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EmergencyScreen.tsx) | Simplified to `Linking.openURL('tel:')` — opens dialer immediately |
| 2 | Accessibility global | [App.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/App.tsx) | Monkey-patches `Text.render` to apply `fontScale` and `highContrast` to ALL text globally |
| 3 | Year dropdown | [AdminFinanceScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminFinanceScreen.tsx), [AdminSolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminSolicitudesScreen.tsx) | Year is now a dropdown modal, months remain as pills |
| 4 | Excel export | [AdminFinanceScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/AdminFinanceScreen.tsx) | Uses `Buffer.from(xlsx.write(..., type:'buffer')).toString('base64')` |
| 5 | Map pins | [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts), [NeighborhoodMapScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/NeighborhoodMapScreen.tsx), [SolicitudDetailScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/shared/SolicitudDetailScreen.tsx) | Admin creates/manages pins, auto-add from Servicio solicitudes |

## Map Pins Feature Details

- **Store**: `MapPin` type with lat, lng, title, description, category, emoji. 3 seed pins.
- **Map Screen**: Admin sees "Agregar Pin" + "Gestionar" buttons. Pins render as Leaflet markers. WebView re-renders on pin count change.
- **Pin Categories**: `servicio` (🔧) or `punto_interes` (📍). Emoji selector with 12 options.
- **Auto-add from Solicitud**: When admin views a solicitud with category containing "Servicio", "Oficio", or "Emprendimiento", a purple "📍 Agregar como Pin al Mapa" button appears.

> [!NOTE]
> Storage bumped to **v5** — local data resets on first load.
