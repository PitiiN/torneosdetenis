# Plan de Implementación - Eliminar Gestión de Arriendos y Verificaciones

## Descripción
El usuario solicitó eliminar el acceso a la "Gestión de Arriendos" y la verificación de pagos desde el panel de administración. Esto implica eliminar botones, tarjetas y enlaces de navegación que apunten a esta funcionalidad.

## Cambios Propuestos

### Frontend

#### [MODIFY] [admin page](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/admin/page.tsx)
- Eliminar la tarjeta "Por Verificar" (resumen de estado).
- Ajustar la grilla de tarjetas de `md:grid-cols-3` a `md:grid-cols-2`.
- Eliminar el botón "Verificar Pagos" de la sección "Acciones Rápidas".

## Plan de Verificación

### Verificación Manual
1. Abrir el panel de administración (`/admin`).
2. Verificar que la tarjeta "Por Verificar" ha desaparecido y el diseño de 2 columnas se ve correcto.
3. Verificar que el botón "Verificar Pagos" ha desaparecido.
