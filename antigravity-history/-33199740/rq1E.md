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
