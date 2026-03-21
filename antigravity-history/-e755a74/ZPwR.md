# Plan de Implementación - Corrección Vistas de Disponibilidad

## Problemas Detectados
1. **Admin - Nombres faltantes**: Reservas de invitados sin nombre.
2. **Admin - Reservas invisibles**: Posible desajuste de zona horaria.
3. **Usuario - Reservas invisibles**: El usuario reporta que tampoco ve las reservas ocupadas.

## Cambios Propuestos

### Backend
#### [MODIFY] [recurring bookings api](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/bookings/recurring/route.ts)
- Aceptar `verificationNote` y guardarlo.

### Frontend (Admin)
#### [MODIFY] [booking edit modal](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/admin/BookingEditModal.tsx)
- Agregar input para nombre de invitado.

#### [MODIFY] [admin calendar view](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/admin/AdminCalendarView.tsx)
- Corregir renderizado de nombres.
- **Critical**: Normalizar fechas usando `date-fns-tz` y `America/Santiago` para asegurar coincidencia visual con los slots.

### Frontend (User)
#### [MODIFY] [User Calendar Component] (TBD - Buscar archivo)
- Aplicar la misma corrección de zona horaria que en el admin.
- Verificar lógica de `getSlotStatus`.

## Plan de Verificación
1. **Admin**: Crear reserva manual con nombre y verificar visualización.
2. **User**: Entrar como usuario normal y verificar que esa misma hora aparece como "Ocupado" o no disponible.
