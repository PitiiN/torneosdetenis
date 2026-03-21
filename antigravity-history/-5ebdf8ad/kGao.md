# Tareas - Ronda 3: Rediseño UI y Nuevas Funcionalidades

## A. Vista Usuario – Inicio (HomeScreen)
- [x] Eliminar emoji 👋 del banner y reducir padding del saludo
- [x] Cambiar grid a 3 columnas y agregar todos los accesos de "Más"
- [x] Eliminar sección "Avisos Importantes" del Inicio

## B. Avisos – Lógica de Caducidad
- [x] Añadir `expiresAt` a tipo `Announcement` en `store.ts`
- [x] En `AnnouncementsScreen` separar Avisos Importantes / Normales y filtrar por caducidad
- [x] En `ManageAnnouncementsScreen` agregar campo "Fecha de caducidad" (con opción "No aplica")
- [x] Encuestas: ocultar para usuarios las que pasaron su deadline
- [x] Admin: botón "Ver históricos" para Avisos y Encuestas caducados (secciones separadas)

## C. Admin – Panel (DashboardScreen)
- [x] Eliminar corona del banner y reducir su tamaño
- [x] Grid 3 columnas con todos los accesos de "Admin" (sin sección Acciones Rápidas)
- [x] Eliminar Resumen Financiero del Panel

## D. Admin – Avisos (ManageAnnouncementsScreen)
- [x] Agregar filtro por año y mes (mismo formato que Agenda)

## E. S.O.S – Botones adicionales (EmergencyScreen)
- [x] Agregar botones: Gestor Territorial, Seguridad Ciudadana, Comisaría San Miguel, Cesfam Angel Guarello, Cesfam Recreo

## F. Agenda – Mejoras (EventsScreen)
- [x] Añadir campo `description` a `EventItem`
- [x] Formulario admin: título, lugar, fecha (calendario), emoji, descripción
- [x] Usuario: al pinchar evento mostrar pop-up con info + descripción

## G. Solicitudes (SolicitudesScreen)
- [x] Cambiar ícono de envío (📤 → ✅)

## H. Mapa del Barrio – Estructura expandida (NeighborhoodMapScreen)
- [x] Servicio: campos Categoría, Contacto WhatsApp, RRSS Instagram y Facebook
- [x] Punto de Interés: solo Nombre y Descripción
- [x] Usuarios pueden dejar reseñas y puntuación 1-5 estrellas (en modal separado)
