# PLAN MVP Hardening

## 1) Auditoria actual

### Stack
- Mobile app con Expo SDK 54 + React Native + TypeScript estricto.
- Navegacion: `@react-navigation/native` + bottom tabs.
- Backend: Supabase (Auth, Postgres, Storage).
- Estado: hooks locales por pantalla (`useState`, `useEffect`, `useMemo`), sin store global.

### Estructura de pantallas
- `App.tsx`: auth gate + tabs.
- `src/screens/LoginScreen.tsx`: login/signup basico.
- `src/screens/HomeScreen.tsx`: dashboard simple + logout.
- `src/screens/ProfileScreen.tsx`: lectura/edicion de perfil.
- `src/screens/TournamentsScreen.tsx`: listado torneos, detalle categorias, inscripcion, pagos manuales, fixtures.
- `src/screens/AdminScreen.tsx`: gestion torneos/categorias, RR/ELIM, resultados, canchas, scheduling, outbox.
- Estado actual: `App.tsx` importa `NotificationsScreen` pero el archivo no existe (rota compilacion).

### Autenticacion (implementado vs faltante)
- Implementado:
  - `supabase.auth.getSession()` + `onAuthStateChange` en `App.tsx`.
  - Login (`signInWithPassword`) y signup (`signUp`).
  - Logout en Home.
  - Gate: sin sesion => Login; con sesion => Tabs.
- Faltante o debil:
  - Manejo de errores consistente y reusable.
  - Validaciones de formulario (email/password) mas fuertes.
  - Flujo post-signup guiado (actualmente solo alert).
  - Pantalla dedicada de fallback/retry ante fallos de carga.

### Modelo de datos detectado
- Core:
  - `profiles` (rol, datos personales, nivel).
  - `tournaments`
  - `categories` (+ precio CLP)
  - `registrations`
  - `payment_proofs`
- Competencia:
  - `draws`
  - `matches`
  - `rr_groups`
  - `rr_group_members`
  - `match_events`
- Scheduling:
  - `courts`
  - `court_blocks`
  - `schedules`
- Comunicacion:
  - `notifications_outbox`

### Backend (migraciones/RLS/endpoints)
- Migraciones versionadas presentes en repo:
  - `20260302113000_tournaments_mvp.sql`
  - `20260302123000_categories_price_fields.sql`
  - `20260302143000_manual_payment_proofs.sql`
- Problema actual:
  - La app usa tablas de draws/scheduling/outbox pero esas migraciones no estan versionadas aqui.
  - No hay Edge Functions activas (seed/cleanup fueron removidas).

### Estado de calidad actual
- `npx tsc --noEmit`: falla por imports faltantes:
  - `NotificationsScreen` inexistente.
  - `src/domain/*` inexistente (`draws`, `roundRobin`, `scoring`).
- Hay codigo de negocio en pantallas grandes (riesgo de mantenimiento/regresiones).

## 2) Backlog priorizado

### Must (MVP listo usuarios)
1. Restaurar build estable:
   - Crear modulos `src/domain/*` faltantes.
   - Crear `NotificationsScreen`.
   - Corregir tipos implicitos en Admin/Torneos.
2. Hardening de UX de error:
   - Componente/pantalla de error con retry.
   - Manejo uniforme de errores de red/Supabase.
3. Auth y rutas privadas solidas:
   - Login/signup/logout con validaciones basicas.
   - Persistencia de sesion verificada.
4. Torneos:
   - Listado + detalle + inscripcion/cancelacion.
   - Estado visible de inscripcion y pago.
5. Brackets/fixtures:
   - Render por ronda y fase.
   - fallback claro cuando no existe draw.
6. Admin/Organizer:
   - visibilidad por rol.
   - crear torneo/categoria.
   - operar resultados y scheduling sin crash.
7. Calidad y operacion:
   - scripts `typecheck`, `lint`, `test`, `build`.
   - `RUNBOOK.md` + checklist smoke tests.

### Should
1. Reducir duplicacion de consultas Supabase.
2. Mejorar copy UI (acentos, estados, mensajes).
3. Reintentos suaves en cargas importantes.
4. Test basico de dominio (scoring o seeding).

### Could
1. Separar capa de servicios (`src/services/*`).
2. Introducir React Query.
3. Mejorar accesibilidad (labels, focus order).

## 3) Riesgos y dependencias
- Riesgo alto: drift entre DB real y migraciones versionadas en repo.
- Riesgo medio: RLS no cubriendo tablas nuevas si no se versionan.
- Riesgo medio: logica compleja en pantallas (Admin/Torneos) dificil de testear.
- Dependencias:
  - Variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Esquema Supabase alineado con pantallas.

## 4) Definicion de Done (global)
- App compila y `npx tsc --noEmit` pasa.
- Scripts `typecheck`, `lint`, `test`, `build` disponibles y ejecutables.
- Gate de auth funcional y persistente.
- Usuario player puede:
  - loguearse, editar perfil, ver torneos, inscribirse, ver estado y fixtures.
- Admin/organizer puede:
  - crear torneo/categoria, generar/operar cuadros, gestionar scheduling.
- RUNBOOK documenta setup, ejecucion y smoke tests.

## 5) Criterios de aceptacion por feature

### Auth + Perfil
- Signup/login validan inputs y muestran errores claros.
- Logout devuelve a pantalla de auth.
- Al reiniciar app, la sesion persiste.

### Torneos + Inscripcion
- Listado muestra estado y fechas.
- Detalle muestra categorias y precio.
- Inscribirse/cancelar refleja cambios en UI tras refresh.

### Brackets/Fixtures
- Si hay draw, se muestran rondas y partidos.
- Si no hay draw, se informa sin romper pantalla.

### Admin
- Tab solo visible para `admin`/`organizer`.
- Crear torneo/categoria funciona con feedback de error/success.
- Editar resultado avanza winner en ELIM.

### Operacion/QA
- RUNBOOK y smoke tests permiten validar flujo e2e manual.
