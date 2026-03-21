# Ronda 3 – Walkthrough de Cambios

## Resumen
Se implementaron **11 áreas de cambio** en las vistas de Usuario y Admin.

## Cambios Realizados

### 1. Vista Usuario – Inicio ([HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx))
- ❌ Eliminado emoji 👋 y reducido padding del banner
- ✅ Grid de **3 columnas** con **11 accesos rápidos** (todos los de "Más" incluidos)
- ❌ Eliminada sección "Avisos Importantes" del Inicio

### 2. Admin – Panel ([DashboardScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/DashboardScreen.tsx))
- ❌ Eliminado ícono corona, reducido banner
- ✅ Grid **3 columnas** con 9 accesos rápidos (Socios, Avisos, Solicitudes, Docs, Finanzas, Favores, Agenda, Mapa, Config)
- ❌ Eliminado Resumen Financiero y sección "Acciones rápidas"

### 3. Avisos – Caducidad ([store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts) + [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx))
- ✅ Campo `expiresAt` en `Announcement` (`null` = "No aplica", siempre visible)
- ✅ Avisos separados en **🔴 Importantes** y **📢 Normales**
- ✅ Avisos/Encuestas caducados se ocultan automáticamente para usuarios
- ✅ Admin puede ver **históricos** con botones colapsables separados

### 4. Admin – Gestionar Avisos ([ManageAnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/admin/ManageAnnouncementsScreen.tsx))
- ✅ Campo **"Fecha de caducidad"** con switch "No aplica" y DateTimePicker
- ✅ Filtro por **mes y año** (mismo estilo que Agenda)
- ✅ Secciones separadas para históricos de Avisos y Encuestas

### 5. S.O.S ([EmergencyScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EmergencyScreen.tsx))
- ✅ 5 botones nuevos: Gestor Territorial, Seguridad Ciudadana, Comisaría San Miguel, Cesfam Angel Guarello, Cesfam Recreo (números placeholder)

### 6. Agenda ([EventsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/EventsScreen.tsx))
- ✅ Campo `description` en `EventItem`
- ✅ Admin: **DateTimePicker** para fecha + campo descripción
- ✅ Usuario: **popup modal** al pinchar evento con info completa

### 7. Solicitudes ([SolicitudesScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/SolicitudesScreen.tsx))
- ✅ Ícono cambiado de 📤 a ✅

### 8. Mapa del Barrio ([NeighborhoodMapScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/NeighborhoodMapScreen.tsx))
- ✅ **Servicio**: Subcategoría (Salud/Deporte/etc.), WhatsApp, Instagram, Facebook
- ✅ **Punto de Interés**: solo Nombre y Descripción
- ✅ **Sistema de reseñas**: ⭐ 1-5 estrellas + comentario en modal de detalle

## Verificación
- `tsc --noEmit` — Solo errores pre-existentes del Edge Function de Deno (no relacionados)
- Store bumped a `v6` para recoger nuevos campos
