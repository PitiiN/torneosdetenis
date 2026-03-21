# Ronda 3 – Rediseño UI y Nuevas Funcionalidades

Implementar cambios solicitados en las vistas de Usuario y Admin, incluyendo rediseño de paneles de inicio, lógica de caducidad para avisos/encuestas, botones S.O.S adicionales, mejoras en la Agenda, y campos expandidos en el Mapa del Barrio.

## Proposed Changes

### Store (`store.ts`)
#### [MODIFY] [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts)
- Add `expiresAt?: string | null` to `Announcement` type (`null` = "No aplica", always visible)
- Add `description?: string` to `EventItem` type
- Add `subcategory`, `contactWhatsapp`, `socialInstagram`, `socialFacebook` to `MapPin` type
- Add `reviews` array to `MapPin` type (with `{ userId, userName, rating, comment, date }`)
- Add `addMapPinReview` action

---

### User HomeScreen
#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx)
- Remove 👋 emoji, shrink banner padding (24→14)
- Change grid to 3-per-row (`width: '31%'`, smaller padding/emoji)
- Add all menu items from `MoreScreen` as quick-access cards (Cuotas, Documentos, Solicitudes, Favores, Mapa, Perfil, Accesibilidad, Encuestas)
- Remove entire "Avisos Importantes" section at bottom

---

### AnnouncementsScreen
#### [MODIFY] [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx)
- Filter out expired announcements for users (where `expiresAt` is set and past)
- Split remaining into "🔴 Avisos Importantes" and "📢 Avisos Normales" sections
- Same expiry filter for Encuestas tab (hide past-deadline polls)

---

### Admin ManageAnnouncementsScreen
#### [MODIFY] [ManageAnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/ManageAnnouncementsScreen.tsx)
- Add "Fecha de caducidad" field with DateTimePicker + "No aplica" toggle
- Add year/month filter (reuse Agenda-style month selector)
- Add "Ver históricos" toggle button to show expired avisos/encuestas

---

### Admin DashboardScreen
#### [MODIFY] [DashboardScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/DashboardScreen.tsx)
- Remove crown emoji, reduce banner padding
- Replace 2-column grid + "Acciones Rápidas" + Finance summary with 3-column grid of ALL admin shortcuts (Panel, Avisos, Solicitudes, Docs, Socios, Finanzas, Favores, Agenda, Mapa, Configuración)

---

### EmergencyScreen (S.O.S)
#### [MODIFY] [EmergencyScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EmergencyScreen.tsx)
- Add 5 new contact buttons: Gestor Territorial, Seguridad Ciudadana, Comisaría San Miguel, Cesfam Angel Guarello, Cesfam Recreo (with placeholder phone numbers)

---

### EventsScreen (Agenda)
#### [MODIFY] [EventsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EventsScreen.tsx)
- Admin form: replace text date input with DateTimePicker calendar, add description field
- User view: tapping event opens a Modal popup with full details + description

---

### SolicitudesScreen
#### [MODIFY] [SolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/SolicitudesScreen.tsx)
- Change submit button emoji from `📤` → `📨` or `✅`

---

### NeighborhoodMapScreen
#### [MODIFY] [NeighborhoodMapScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/NeighborhoodMapScreen.tsx)
- When category is "servicio": show fields for Subcategoría (Salud, Deporte, Servicios hogar, Comida, Otro), Contacto WhatsApp, RRSS Instagram, RRSS Facebook
- When category is "punto_interes": show only Nombre and Descripción
- Add review system: users can tap a pin → see reviews → add their own review with 1-5 star rating + comment

## Verification Plan

### Manual Verification
- Reload Expo Go, verify HomeScreen shows 3-column grid without important avisos section
- Test creating an aviso with expiration date and verify it disappears for users after that date
- Test admin panel has 3-column grid without finance summary
- Verify S.O.S has all 9 buttons
- Test Agenda event popup for users and calendar picker for admins
- Test Map pin creation with new service fields and review system
