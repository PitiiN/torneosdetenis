# PRD — App Torneos de Tenis (Mobile-only)

## 1) Resumen
App para gestionar torneos/circuitos de tenis con foco en: inscripciones y pagos,
cuadros automáticos (incluye consolación), scheduling de canchas con restricciones,
y experiencia en vivo con resultados y llaves en tiempo real.

## 2) Usuarios y Roles
### 2.1 Jugador (Player)
- Se registra e inicia sesión.
- Se inscribe en torneos/categorías.
- Paga inscripción.
- Ve su agenda, resultados, ranking y notificaciones.
- Puede auto-reportar resultado si está habilitado.

### 2.2 Organizador (Organizer)
- Crea torneos y categorías.
- Administra inscripciones y pagos (vista).
- Genera cuadros y programa partidos.
- Opera el torneo en vivo (cambios por lluvia, reprogramación).
- Envía comunicación masiva.

### 2.3 Admin (Admin)
- Permisos superiores: gestión de clubes, usuarios, configuración global.
- Puede intervenir en resultados/disputas y ajustes de ranking.

### 2.4 Árbitro (Referee) [MVP opcional]
- Ingresa resultados en partidos asignados o autorizados.

## 3) Objetivos (MVP)
- Registrar jugadores con perfil deportivo y restricciones horarias.
- Cobrar inscripciones y reflejar estado financiero.
- Generar cuadros (eliminación, round robin, suizo opcional) + consolación/backdraw.
- Seeding automático por ranking interno.
- Transición automática de grupos a eliminación por reglas de desempate.
- Scheduling con inventario de canchas, conflictos y estados live.
- Live scoring con validación de reglas de tenis y realtime updates.
- Dashboard de organizador con finanzas básicas y comunicación masiva.
- Push notifications clave.

## 4) Funcionalidades (detalle)

### 4.1 Gestión de Jugadores e Inscripciones
**Perfiles**
- Datos: nombre, contacto, club, mano (opcional), categoría/nivel (Cuarta/Tercera/Honor),
  historial de partidos, restricciones horarias (bloques no disponibles).
- El jugador puede editar su perfil (salvo campos “administrados” si aplica).

**Inscripciones**
- Un torneo tiene categorías (ej. Singles Honor, Dobles 4ta).
- Un jugador se inscribe a una categoría si cumple requisitos (edad/sexo/nivel si se define).
- Estados de inscripción:
  - DRAFT (iniciada)
  - PENDING_PAYMENT
  - ACTIVE (pagada/confirmada)
  - CANCELLED / REFUNDED

**Pagos**
- Integración Stripe:
  - Crear intención de pago desde Edge Function.
  - Confirmación por webhook -> actualizar `payments` + `registrations`.
- Panel admin: lista de pagos por torneo/categoría, totales, pendientes.

**Ranking interno**
- Ranking por club/circuito y por categoría.
- Puntos por resultado: configurable por torneo (plantilla).
- Actualización automática cuando un match queda “final” y aprobado.

#### Criterios de aceptación (MVP)
- Un jugador puede registrarse, crear perfil, definir restricciones y pagar inscripción.
- Un organizador ve el estado de pago e inscripción en tiempo real.

---

### 4.2 Motor de Formatos y Cuadros (Draws)
**Formatos**
- Eliminación directa (single elimination).
- Round Robin (fase de grupos).
- Consolación / Backdraw (mínimo: para first-round losers o losers de una ronda definida).
- Suizo: opcional (fase 2), dejar diseño preparado.

**Seeding**
- Cabezas de serie por ranking.
- Distribución para evitar cruces tempranos entre seeds altos.

**Transiciones automáticas (Grupos -> Llaves)**
- Criterios: partidos ganados, diferencia sets, diferencia games, y head-to-head como desempate final.
- El sistema calcula clasificados automáticamente al cerrar la fase de grupos.

#### Criterios de aceptación (MVP)
- Con N inscritos, el sistema genera draw consistente, reproducible y validado.
- Al cerrar grupos, se llena automáticamente el bracket de eliminación.

---

### 4.3 Scheduling y Gestión de Canchas
**Inventario**
- Canchas por club/sede.
- Horario apertura/cierre por día de semana.
- Bloques de mantención / lluvia / bloqueo manual.

**Asignación inteligente (MVP heurístico)**
- Inputs: disponibilidad canchas + restricciones jugador + descanso mínimo.
- Validaciones:
  - Un jugador no puede tener 2 partidos al mismo tiempo.
  - Respetar descanso mínimo configurable (ej. 45 min).
- Output: propuesta de schedule + opción de “publicar”.

**Estados live de cancha**
- FREE / IN_PLAY / DELAYED / MAINTENANCE

#### Criterios de aceptación (MVP)
- Organizador puede generar un schedule que evita topes básicos.
- Cambiar estado de cancha afecta la planificación (recomendación de reprogramación).

---

### 4.4 Experiencia en Vivo
**Ingreso de resultados**
- Permisos: admin/organizer/referee siempre; player si match habilita auto-reporte.
- Validación reglas:
  - Sets a 6 games, tie-break (7) configurable.
  - Opción super tie-break a 10 en 3er set.
  - Estados: SCHEDULED, IN_PLAY, FINAL_PENDING_APPROVAL, FINAL, WALKOVER, RETIRED.
- Disputas:
  - Si auto-reporte, permitir confirmación del rival o aprobación admin.

**Cuadros y agenda en tiempo real**
- Realtime updates al registrar resultado o reprogramar.
- Vista pública interna: llaves, próximos partidos, canchas.

**Notificaciones**
- Push: “Tu partido comienza en 15 min”, cambios de cancha/hora, suspensión por clima.
- Email: opcional fase 2.

#### Criterios de aceptación (MVP)
- Al ingresar un resultado válido, el bracket se actualiza automáticamente.
- Los jugadores reciben push ante cambios relevantes.

---

### 4.5 Panel del Organizador (Dashboard)
**Finanzas**
- Totales: ingresos por inscripciones, pagos confirmados vs pendientes.
- Export básico (CSV) (fase 2 opcional).

**Comunicación masiva**
- Enviar mensaje a inscritos por torneo/categoría.
- Canales: push (MVP) + email (fase 2).

#### Criterios de aceptación (MVP)
- Organizador ve KPIs simples y puede enviar comunicación segmentada.

---

### 4.6 Perfiles “Usuario” y “Admin” (claridad total)
**Jugador**
- Home: próximos partidos + notificaciones
- Torneos: inscritos y disponibles
- Perfil: ranking, historial, restricciones
- Pagos: estado y comprobantes

**Admin/Organizer**
- Home: estado del torneo en vivo
- Inscripciones/pagos
- Draws: generar/publicar
- Scheduling: generar/publicar + estados cancha
- Resultados: aprobar/editar + auditoría
- Comunicaciones

## 5) Requerimientos No Funcionales
- Mobile-only, rendimiento fluido en listas grandes.
- Realtime confiable (Supabase Realtime).
- Seguridad: RLS estricto.
- Observabilidad básica: logs en Edge Functions + auditoría de cambios.

## 6) MVP Scope (lo que sí)
- Auth + roles
- Torneos/categorías/inscripciones/pagos
- Eliminación + RR + consolación + seeding
- Scoring + aprobación
- Scheduling heurístico + estados cancha
- Push notifications básicas
- Dashboard finanzas simple + comunicación push

## 7) Fuera de Scope (por ahora)
- Suizo completo (fase 2)
- Streaming / TV court features
- Multi-sede compleja con travel-time
- Patrocinios/ads