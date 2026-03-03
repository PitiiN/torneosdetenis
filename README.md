# Torneos de Tenis (Expo + Supabase)

App mobile (Expo SDK 54) para gestion de torneos de tenis.

## Requisitos

- Node.js 20+
- npm 10+

## Setup

1. Instalar dependencias:
```bash
npm install
```
2. Si agregas dependencias nativas, usar Expo install:
```bash
npx expo install @react-native-picker/picker
```
3. Crear `.env` desde el template:
```bash
copy .env.example .env
```
4. Completar variables en `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Migraciones SQL (Supabase)

Se definio estructura en `supabase/migrations`.

Archivo MVP de torneos/categorias/inscripciones:
- `supabase/migrations/20260302113000_tournaments_mvp.sql`
- `supabase/migrations/20260302123000_categories_price_fields.sql`
- `supabase/migrations/20260302143000_manual_payment_proofs.sql`
- `supabase/migrations/20260302163000_draws_matches_mvp.sql`
- `supabase/migrations/20260302170000_round_robin_mvp.sql`
- `supabase/migrations/20260302171000_scoring_audit_mvp.sql`
- `supabase/migrations/20260302172000_scheduling_mvp.sql`
- `supabase/migrations/20260302173000_notifications_outbox_mvp.sql`

Aplicacion sugerida:
1. Abrir Supabase Dashboard -> SQL Editor.
2. Copiar y ejecutar el contenido del archivo SQL.
3. Verificar que existen tablas `tournaments`, `categories`, `registrations`, `payment_proofs`, `draws`, `matches`, `rr_groups`, `rr_group_members`, `match_events`, `courts`, `court_blocks`, `schedules`, `notifications_outbox` con RLS activo.

## Precio por categoria (MVP manual)

- El precio se guarda en `categories.price_amount` (entero en CLP).
- Moneda fija en `categories.currency` con default `clp`.
- Este valor sera usado por Stripe en el ticket de pagos.

## Pagos manuales por transferencia

- Tabla `payment_proofs`: workflow `SUBMITTED -> APPROVED/REJECTED/NEEDS_INFO`.
- Bucket privado de Storage: `payment-proofs` (creado por migracion).
- Convencion de path para archivos: `{user_id}/{registration_id}/{timestamp}.{ext}`.
- Policies:
  - player sube y ve sus comprobantes.
  - admin/organizer ve todos los comprobantes.
- Al aprobar desde Admin (`review_payment_proof`), la inscripcion asociada cambia a `registrations.status = ACTIVE`.

## Draws MVP (single elimination)

- Tablas:
  - `draws` (1 draw por categoria)
  - `matches` (round, match_number, slots, winner, score_json)
- Generacion de cuadro en Admin:
  - Ir a categoria y usar `Generar cuadro` (requiere inscritos `ACTIVE`).
  - Seeding: ranking si existe en profile (`ranking`/`ranking_points`/`points`), si no por orden de inscripcion.
  - Se crean matches de Round 1 y rondas siguientes con slots vacios.
- Operacion de resultados:
  - En Admin, `Editar match` -> seleccionar ganador + `score_json`.
  - Al guardar, el ganador avanza automaticamente al slot correspondiente del siguiente match.
- Player:
  - En Torneos, vista lectura de cuadro por rondas y seccion de proximos matches.

## Round Robin -> Eliminacion

- En Admin:
  - Seleccionar categoria, definir `Cantidad grupos` y `Top K`.
  - `Generar RR` crea grupos (`rr_groups`), miembros (`rr_group_members`) y matches RR (`phase='RR'`).
  - Cargar resultados de RR en `Editar match` hasta dejar todos en `FINAL`.
  - `Cerrar fase de grupos` calcula standings con desempates:
    - wins
    - set_diff
    - game_diff
    - head_to_head (solo empate de 2)
    - fallback deterministico por user_id para empates de 3+
  - Luego genera fase ELIM (`phase='ELIM'`) en el mismo draw.

## Scoring + Auditoria

- `Editar match` usa UI guiada por sets (3 sets).
- Validacion fuerte:
  - Sets normales a 6 con tie-break.
  - Opcion super tie-break en 3er set por categoria (`third_set_super_tiebreak`).
  - ganador debe coincidir con el score.
- Cada guardado inserta auditoria en `match_events`:
  - `RESULT_EDITED`
  - `WINNER_ADVANCED` cuando aplica en ELIM.

## Scheduling + Estados de Cancha

- Admin:
  - Crear canchas (`courts`).
  - Crear bloqueos (`court_blocks`).
  - Asignar partido a cancha/hora y estado (`schedules`).
- Player:
  - En Torneos, `Mis proximos matches` muestra cancha/hora/estado.

## Notificaciones Lite (Outbox)

- Tabla `notifications_outbox` como cola de notificaciones.
- Se encola automaticamente:
  - cuando se crea/actualiza `schedules`
  - cuando un comprobante cambia a `APPROVED`
- Admin:
  - `Enviar aviso masivo` inserta outbox por categoria.
- Player:
  - Tab `Notificaciones` muestra su outbox.

## Smoke tests (10 pasos)

1. Crear 1 torneo y 1 categoria desde Admin.
2. Inscribir al menos 4 players y dejar sus `registrations` en `ACTIVE`.
3. En Admin, generar RR con 2 grupos y `Top K = 2`.
4. Verificar en Torneos que players ven grupos, standings y matches RR.
5. Editar todos los matches RR a `FINAL` con score valido.
6. Ejecutar `Cerrar fase de grupos` y verificar que aparece llave ELIM.
7. Editar un match ELIM y confirmar avance automatico del winner al siguiente match.
8. Crear una cancha, un bloqueo y un schedule para un match.
9. Verificar en player `Mis proximos matches` la cancha/hora/estado.
10. En Admin enviar aviso masivo y validar que player lo ve en tab `Notificaciones`.

## Ejecutar

```bash
npx expo start -c
```

## Navegacion actual (MVP)

- Sin sesion: `LoginScreen`
- Con sesion: tabs `Home`, `Torneos`, `Perfil`
- Tab adicional: `Notificaciones`
- Tab `Admin` visible solo si `profiles.role` es `admin` u `organizer`
- `Torneos`: lista torneos/categorias y permite inscribirse en `PENDING_PAYMENT`
- `Admin`: RR->ELIM, scoring, scheduling, avisos masivos
