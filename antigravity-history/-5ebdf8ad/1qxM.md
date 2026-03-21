# Tareas - Ronda 3: Rediseño UI y Nuevas Funcionalidades

## A. Vista Usuario – Inicio (HomeScreen)
- [ ] Eliminar emoji 👋 del banner y reducir padding del saludo
- [ ] Cambiar grid a 3 columnas y agregar todos los accesos de "Más"
- [ ] Eliminar sección "Avisos Importantes" del Inicio

## B. Avisos – Lógica de Caducidad
- [ ] Añadir `expiresAt` a tipo `Announcement` y `Poll` en `store.ts`
- [ ] En `AnnouncementsScreen` separar Avisos Importantes / Normales y filtrar por caducidad
- [ ] En `ManageAnnouncementsScreen` agregar campo "Fecha de caducidad" (con opción "No aplica")
- [ ] Encuestas: ocultar para usuarios las que pasaron su deadline
- [ ] Admin: botón "Ver históricos" para Avisos y Encuestas caducados

## C. Admin – Panel (DashboardScreen)
- [ ] Eliminar corona del banner y reducir su tamaño
- [ ] Grid 3 columnas con todos los accesos de "Admin" (sin sección Acciones Rápidas)
- [ ] Eliminar Resumen Financiero del Panel

## D. Admin – Avisos (ManageAnnouncementsScreen)
- [ ] Agregar filtro por año y mes (mismo formato que Agenda)

## E. S.O.S – Botones adicionales (EmergencyScreen)
- [ ] Agregar botones: Gestor Territorial, Seguridad Ciudadana, Comisaría San Miguel, Cesfam Angel Guarello, Cesfam Recreo

## F. Agenda – Mejoras (EventsScreen)
- [ ] Añadir campo `description` a `EventItem`
- [ ] Formulario admin: título, lugar, fecha (calendario), emoji, descripción
- [ ] Usuario: al pinchar evento mostrar pop-up con info + descripción

## G. Solicitudes (SolicitudesScreen)
- [ ] Cambiar ícono de envío (📤 → ✅ o ícono adecuado)

## H. Mapa del Barrio – Estructura expandida (NeighborhoodMapScreen)
- [ ] Servicio: campos Categoría (Salud, Deporte, etc.), Contacto (WhatsApp), RRSS (Instagram, Facebook)
- [ ] Punto de Interés: solo Nombre y Descripción
- [ ] Usuarios pueden dejar reseñas y puntuación (1-5 estrellas)
