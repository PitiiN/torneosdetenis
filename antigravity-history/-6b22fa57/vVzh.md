# Panel de Administración Avanzado - ArriendoCanchas

Transformar la vista del administrador para incluir gestión completa de reservas, reportes financieros y operaciones en lote.

## User Review Required

> [!IMPORTANT]
> **Lógica de negocio a confirmar:**
> 1. Para marcar reservas como "PAGADA" en lote, ¿se requiere alguna validación adicional o simplemente seleccionar y confirmar?
> 2. ¿Los precios de las canchas están fijos en el frontend o deberían venir de la base de datos?
> 3. Para las reservas periódicas, ¿hay un límite máximo de días que se pueden seleccionar de una vez?

---

## Proposed Changes

### 1. Admin Availability Page (Nueva Vista Principal)

#### [NEW] [AdminAvailabilityPage](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/admin/availability/page.tsx)

Vista de disponibilidad similar a la del usuario pero con capacidades extendidas:
- Misma grilla semanal con todos los slots
- Click en cualquier slot (disponible, reservado, pendiente) abre modal de gestión
- Capacidad de **crear reservas en múltiples días** (selección múltiple)
- Capacidad de **editar cualquier reserva** existente

---

### 2. Modal de Edición de Reserva

#### [NEW] [BookingEditModal](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/admin/BookingEditModal.tsx)

Modal completo para edición de reservas:
- Cambiar **fecha y hora** (start_at, end_at)
- Cambiar **cancha** (field_id)
- Cambiar **estado** (status: todos los valores del enum)
- Cambiar **usuario asignado** (user_id) - con buscador de usuarios
- Campo de **notas de verificación**

---

### 3. Panel Financiero

#### [NEW] [FinancialPage](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/admin/financial/page.tsx)

Dashboard de estados financieros:
- **Resumen por cancha**: Total reservas, pagadas vs no pagadas, monto total
- **Gráfico de ingresos** por período (7d, 30d, 90d)
- **Lista de morosos**: Usuarios con reservas no pagadas (PENDIENTE_PAGO, EN_VERIFICACION)
- Filtros por cancha y rango de fechas

---

### 4. Operación de Pago en Lote

#### [NEW] [BulkPaymentModal](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/admin/BulkPaymentModal.tsx)

- Seleccionar usuario de una lista de usuarios con deudas
- Ver todas sus reservas pendientes de pago
- Checkbox para seleccionar múltiples reservas
- Botón "Marcar como Pagadas" que actualiza todas en una operación

---

### 5. API Endpoints

#### [MODIFY] [route.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/bookings/route.ts)

Agregar método `PATCH` para actualización de reservas individuales con todos los campos editables.

### Financial Panel Enhancements
#### [MODIFY] [page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/admin/financial/page.tsx)
- Add Month Selector (reusing logic from Admin Dashboard).
- Add Field Selector.
- Update fetch logic to use `month` and `fieldId`.

#### [MODIFY] [route.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/financial/route.ts)
- Update query params handling (`month`, `fieldId`).
- Filter bookings by custom date range (Month) and Field ID.

#### [NEW] [bulk-payment route](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/bookings/bulk-payment/route.ts)

Endpoint para marcar múltiples reservas como pagadas:
```typescript
POST /api/admin/bookings/bulk-payment
Body: { bookingIds: string[] }
```

#### [NEW] [recurring route](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/bookings/recurring/route.ts)

Endpoint para crear reservas en múltiples días:
```typescript
POST /api/admin/bookings/recurring
Body: { fieldId, userId, dates: string[], startTime, endTime, status }
```

#### [NEW] [financial route](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/financial/route.ts)

Endpoint para obtener estadísticas financieras agrupadas por cancha.

#### [NEW] [debtors route](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/admin/debtors/route.ts)

Endpoint para obtener usuarios con reservas sin pagar.

---

### 6. Navegación Admin

#### [MODIFY] [DashboardLayout](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/dashboard/DashboardLayout.tsx)

Agregar nuevas opciones al menú de admin:
- `Disponibilidad Admin` → `/admin/availability`
- `Panel Financiero` → `/admin/financial`

---

### 7. Extras Sugeridos

1. **Historial de cambios**: Log de quién modificó cada reserva (ya existe `status_updated_by`)
2. **Exportar a Excel**: Botón para descargar reporte financiero
3. **Notificaciones**: Badge en el menú cuando hay reservas pendientes de verificación
4. **Filtro rápido por usuario**: En la vista de reservas, poder buscar por nombre/teléfono

---

## Verification Plan

### Browser Testing (Manual)

1. **Admin Availability**:
   - Navegar a `/admin/availability`
   - Verificar que se muestra la misma grilla que el usuario pero con opciones extendidas
   - Crear una reserva periódica seleccionando múltiples días
   - Editar una reserva existente cambiando fecha, cancha y estado

2. **Pago en Lote**:
   - Ir a Panel Financiero
   - Seleccionar un usuario con deudas
   - Marcar 2+ reservas como pagadas
   - Verificar que los cambios se reflejan en `/availability` del usuario

3. **Panel Financiero**:
   - Verificar que muestra correctamente pagadas vs pendientes por cancha
   - Verificar lista de morosos

### Automated Tests

Este proyecto no tiene tests unitarios configurados. La verificación será manual a través del navegador.

---

## Estimated Effort

| Componente | Archivos | Complejidad |
|------------|----------|-------------|
| Admin Availability Page | 1 | Alta |
| BookingEditModal | 1 | Media |
| Financial Page | 1 | Media |
| BulkPaymentModal | 1 | Media |
| API Endpoints | 5 | Media |
| Navigation Update | 1 | Baja |
| **Total** | **~10 archivos** | **~2-3 horas** |
