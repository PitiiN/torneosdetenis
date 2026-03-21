# Accesos Rápidos (6 botones) + Respuestas en Avisos

Agregar el botón "Favores" y "Agenda" al HomeScreen para completar 6 accesos rápidos, y añadir funcionalidad de respuesta de usuarios en la pantalla de Avisos.

## Proposed Changes

### HomeScreen — Accesos Rápidos (6 botones)

#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/HomeScreen.tsx)

Actualmente hay 4 botones: Avisos, Emergencia, Documentos, Solicitudes. Se agregarán 2 más:
- **Agenda** (📅, bg `#F5F3FF`) → navega al tab "Agenda"
- **Favores** (🤝, bg `#FFF7ED`) → muestra un `Alert.alert` con "Próximamente" (funcionalidad para después)

Array `quickActions` quedará con 6 elementos en grid 2x3.

---

### AnnouncementsScreen — Respuestas de Usuarios

#### [MODIFY] [store.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/lib/store.ts)

- Agregar campo `replies` al tipo `Announcement`: `replies: { id: string; message: string; userName: string; date: string }[]`
- Agregar acción `addAnnouncementReply(announcementId, message, userName)` al store
- Valor por defecto de `replies` = `[]` en announcements seed

#### [MODIFY] [AnnouncementsScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/AnnouncementsScreen.tsx)

- Agregar input de respuesta debajo de cada aviso (TextInput + botón enviar)
- Mostrar las respuestas existentes debajo del cuerpo del aviso (lista de burbujas estilo chat)
- Usar `useAuth()` para obtener el nombre del usuario
- Expandir/colapsar respuestas con botón "Ver X respuestas"

#### [NEW] [FavoresScreen.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/JJVV/jjvv-mobile/src/screens/user/FavoresScreen.tsx)

Pantalla placeholder con mensaje "Próximamente" y diseño atractivo. Se registrará en MoreStack para navegación futura.

---

## Verification Plan

### Manual Verification
1. Correr `npx expo start` y verificar en el dispositivo o emulador:
   - HomeScreen muestra 6 botones en grid 2x3
   - Botón "Agenda" navega al tab Agenda
   - Botón "Favores" muestra Alert "Próximamente"
   - En Avisos, cada aviso muestra opción de responder
   - Al escribir y enviar una respuesta, aparece debajo del aviso
   - Las respuestas persisten al salir y volver a la pantalla
