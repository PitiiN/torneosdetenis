# Admin Dashboard Enhancement - Walkthrough

## Resumen de Cambios

Se implementó un panel de administración avanzado y se estandarizó el flujo de reservas para eliminar inconsistencias.

---

## 1. Estandarización de Estados de Reserva

Se unificó el manejo de estados entre el Admin y el Usuario para eliminar ambigüedades.

### Mapeo de Estados
| Estado Interno (DB/Admin) | Estado Usuario (UI) | Comportamiento |
|---------------------------|---------------------|----------------|
| `PENDIENTE_PAGO` | **Hold (Pendiente)** | Bloquea el horario por 10 mins. Se muestra en ámbar. |
| `EN_VERIFICACION` | **Hold (Pendiente)** | En revisión por admin. |
| `PAGADA` | **Pagada** | Reserva confirmada. Color verde. |
| `BLOQUEADA` | **Reservada** | Bloqueo administrativo. No muestra detalles al usuario pero ocupa el slot. |
| `CANCELADA` | **Cancelada** | Espacio liberado. |
| `RECHAZADA` | **Cancelada** | (Deprecado) Se eliminó la opción de crear este estado; se usa Cancelada. |

### Reglas de Negocio Implementadas
- **Expiración Automática**: Las reservas `PENDIENTE_PAGO` ignoran bloqueos de disponibilidad después de **10 minutos** de creadas si no se han pagado.
- **Visualización Unificada**: Se creó el helper `getPublicStatus` para garantizar que el usuario siempre vea los estados simplificados, independientemente de la lógica interna.

---

## 2. Nuevas Funcionalidades Admin

### 1. Panel Financiero Simplificado pero Potente (`/admin/financial`)
- **Filtros Avanzados**:
  - **Selector de Cancha**: Permite ver ingresos y estadísticas de una cancha específica o de todas.
  - **Selector de Mes**: Navegación cronológica (pasado -> futuro) con el mes actual seleccionado por defecto.
- **Tarjetas Resumen**: Ingresos confirmados, pendientes y deuda total.
- **Lista de Morosos Inteligente**: 
  - Solo aparece cuando se selecciona una cancha específica.
  - Al hacer click en un usuario, se abre un **Historial Completo** de sus reservas en esa cancha (pagadas y pendientes).
  - **Gestión Total**: Permite marcar múltiples reservas como **pagadas** O **cancelarlas** definitivamente.

### Panel Financiero (`/admin/financial`)
- Métricas clave: Ingresos confirmados vs pendientes.
- **Gestión de Deudas**: Lista de usuarios con pagos pendientes.
- **Pago en Lote**: Opción para marcar múltiples reservas de un usuario como pagadas en un solo click.

---

## Verificación Realizada

Se ejecutaron scripts de prueba automatizados (`scripts/verify_status_flow.js`) validando:
1. **Mapeo Correcto**: `PENDIENTE_PAGO` se ve como `PENDIENTE`.
2. **Bloqueo de Disponibilidad**: Reservas activas y Bloqueos administrativos impiden nuevas reservas.
3. **Expiración**: Reservas pendientes de más de 10 minutos liberan el slot automáticamente.

## Archivos Clave
- `src/lib/bookings/status.ts`: Lógica central de mapeo.
- `src/app/api/bookings/route.ts`: Validación de overlapping con regla de 10 minutos.
