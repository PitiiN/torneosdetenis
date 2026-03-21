# Rediseño de Grilla de Disponibilidad

Sistema de visualización semanal de disponibilidad de canchas con horarios específicos por día.

---

## Datos de Canchas

| Cancha | Lun-Vie | Sáb-Dom | Precio/hora |
|--------|---------|---------|-------------|
| Huelen 7 | 18:30 - 23:30 | 09:30 - 23:30 | $35.000 |
| Huelen 5 | 18:30 - 23:30 | 09:30 - 23:30 | $15.000 |
| Tabancura 6 | 19:00 - 22:00 | **Cerrado** | $30.000 |

---

## Cambios Propuestos

### 1. Base de Datos
- Actualizar tabla `fields` con precios correctos (`price_per_hour`)
- Insertar/actualizar `field_schedules` con horarios diferenciados por día de semana

### 2. Nueva Vista de Disponibilidad
Rediseño completo de `/availability` con:
- Selector de cancha + fecha
- Grilla semanal (7 columnas: Lun-Dom)
- Filas por hora (slots de 60 min)
- Estados visuales:
  - 🟢 **Reservar** (disponible)
  - 🟠 **Arrendada** (ocupada)
  - ⬜ **Cerrado** (fuera de horario)

### 3. Leyenda Informativa
Banner superior mostrando:
- Nombre cancha seleccionada
- Precio por hora
- Horario de funcionamiento

### 4. Redirección Post-Login
Cambiar dashboard por defecto a `/availability`

---

## Archivos a Modificar

| Archivo | Acción |
|---------|--------|
| `field_schedules` (DB) | INSERT horarios por día |
| `fields` (DB) | UPDATE precios |
| `/availability/page.tsx` | Rediseño completo grilla semanal |
| `/api/availability/route.ts` | Ajustar para retornar semana completa |
| `middleware.ts` | Redirigir login a `/availability` |

---

## Verificación
- [ ] Grilla muestra 7 días con scroll horizontal si necesario
- [ ] Horarios cerrados muestran "Cerrado" 
- [ ] Reservas existentes muestran "Arrendada"
- [ ] Click en slot disponible abre modal de reserva
- [ ] Precios se calculan correctamente

---

## Phase 10: Booking Flow & UX Improvements (NEW)

### 1. Booking Confirmation Modal
- Show Bank Transfer Details upon slot selection (instead of simple confirm)
- Bank Details: Club FC SPA, 77.504.362-8, Cta Cte BICE 21007684, jaravena@f2sports.cl
- Warning: "Si pago no se efectúa en 10 min, la reserva expirará"

### 2. Post-Booking State
- **Status**: New bookings start as `PENDIENTE_PAGO` (remove `EN_VERIFICACION`)
- **Timer**: 10-minute expiration timer visual on frontend
- **My Bookings Page**:
  - Remove "Subir Comprobante" (Upload)
  - Add **"Enviar Comprobante por WhatsApp"** button
  - WhatsApp Message: "Hola, soy [User], arrendé [Cancha] en [Fecha], adjunto comprobante."

### 3. Expiration Logic
- Backend/Frontend check: If status `PENDIENTE_PAGO` and `created_at` > 10 mins -> Show "Expirado" or auto-cancel.

### 4. Visual Feedback (Hold Status)
- Pending bookings (`PENDIENTE_PAGO`) show as **"Hold"** (Yellow) in the grid.
- Prevents double-booking attempts visually.

### 5. WhatsApp Integration
- Message template: "Hola, soy [Nombre], arrendé la [Cancha], el [Fecha] de [Hora Inicio] a [Hora Fin], adjunto mi comprobante..."
- Validates user name and exact time range.
