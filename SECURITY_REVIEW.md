# SECURITY REVIEW - TorneosDeTenis

## Resumen ejecutivo
- Se aplico endurecimiento transversal en cliente, autenticacion, autorizacion, storage y capa SQL (RLS/constraints/triggers/auditoria).
- Se removieron decisiones criticas basadas solo en frontend (incluyendo hardcodeo de super-admin por correo) y se centralizo control de acceso en `src/services/accessControl.ts`.
- Se agrego una migracion de hardening de base de datos con controles de integridad, RLS estricta, funciones helper seguras y auditoria de eventos criticos.
- Se redujo exposicion de datos personales en consultas, logs y manejo de activos (avatar/logo) con URLs firmadas.
- Se elimino tracking de `.env` del repositorio y se dejo `.env.example` seguro.

## Alcance auditado
- Frontend React Native/Expo (auth, tabs, admin, servicios compartidos).
- Integracion Supabase (`auth`, `database`, `storage`, notificaciones push).
- Configuracion y secretos (`.gitignore`, `.env.example`, `app.json`).
- SQL hardening y RLS en `supabase/migrations/20260318123000_security_privacy_hardening.sql`.

## Hallazgos principales y estado

| ID | Hallazgo | Severidad | Estado | Cambio aplicado |
|---|---|---|---|---|
| SEC-01 | Elevacion de privilegios por hardcodeo de super admin en cliente | Critica | Mitigado | Reemplazo por contexto de acceso real (`profiles.role`, `profiles.org_id`, `profiles.is_super_admin`) en `src/services/accessControl.ts`. |
| SEC-02 | Riesgo de control de acceso solo UI en vistas admin | Alta | Mitigado | Guards server-aware en pantallas admin/finanzas con `canManageOrganization` / `canAccessAdminArea`. |
| SEC-03 | Falta de baseline RLS/policies robustas | Critica | Mitigado | Migracion agrega/ajusta RLS y policies de `profiles`, `organizations`, `tournaments`, `registrations`, `matches`. |
| SEC-04 | Riesgo de integridad en inscripciones/resultados manipulables desde cliente | Critica | Mitigado | Trigger `registrations_server_enforcer`, validacion de ganador en `matches`, y policies de write por rol/ownership. |
| SEC-05 | Posible fuga de secretos por `.env` trackeado | Alta | Mitigado parcialmente | `.env` removido del indice, `.gitignore` endurecido, `.env.example` seguro. Requiere rotacion de claves historicas. |
| SEC-06 | Exposicion de tokens/push IDs en logs | Media | Mitigado | Limpieza de logging sensible en notificaciones y errores. |
| SEC-07 | Upload de imagen sin controles estrictos | Alta | Mitigado | MIME/extension/size checks + nombres no predecibles + paths segmentados por owner/org + policies storage. |
| SEC-08 | Uso de URL publica permanente para imagenes | Media | Mitigado | Cambio a almacenamiento de path interno y resolucion por URL firmada en cliente. |
| SEC-09 | Sesion sin limpieza integral de artefactos locales | Media | Mitigado | `secureSignOut()` y `clearSessionArtifacts()` en capa Supabase. |
| SEC-10 | Mensajes de auth demasiado verbosos | Media | Mitigado | Sanitizacion de errores de login/registro en `src/services/errorMessages.ts`. |
| SEC-11 | Falta de trazabilidad de cambios criticos | Alta | Mitigado | `audit_logs` + triggers para `profiles`, `tournaments`, `registrations`, `matches`. |
| SEC-12 | Dependencias con CVEs explotables | Media | Mitigado | `npm audit --omit=dev` sin vulnerabilidades (0). |

## Cambios tecnicos relevantes

### 1) Autenticacion, sesion y cliente
- `src/services/supabase.ts`: secure storage adapter + fail-closed de env vars + limpieza de artefactos de sesion + `secureSignOut()`.
- `app/_layout.tsx`: limpieza de artefactos cuando la sesion pasa a `null`.
- `app/(auth)/login.tsx` y `app/(auth)/register.tsx`: normalizacion de input, mensajes de error seguros, validaciones minimas (password >= 8).

### 2) Autorizacion y roles
- `src/services/accessControl.ts`: contexto de acceso centralizado y reusable (`isSuperAdmin`, `isAdmin`, ownership por organizacion).
- Reemplazo de chequeos inseguros por validaciones consistentes en:
  - `app/(tabs)/_layout.tsx`
  - `app/(tabs)/finance.tsx`
  - `app/(tabs)/settings.tsx`
  - `app/(tabs)/tournaments.tsx`
  - `app/(tabs)/profile.tsx`
  - `app/(admin)/tournaments/create.tsx`
  - `app/(admin)/tournaments/edit/[id].tsx`
  - `app/(admin)/tournaments/[id].tsx`
  - `app/(admin)/finance/[id].tsx`

### 3) Integridad de negocio (frontend no confiable)
- `app/(tabs)/tournaments/[id].tsx`: se removio creacion de `matches` desde vista jugador; solo inscripcion minima (`tournament_id`) y enforcement DB.
- `app/(admin)/tournaments/create.tsx`: minimizacion de PII visible en busqueda/listado de jugadores (sin correo).

### 4) Storage y privacidad de activos
- `src/services/storage.ts`: extraccion de path y resolucion de URL firmada.
- `app/(tabs)/settings.tsx`: `logo_url` pasa a persistir path interno; vista con signed URL.
- `app/(tabs)/profile.tsx`: `avatar_url` pasa a persistir path interno; vista con signed URL.
- `app/(tabs)/index.tsx`: carga de logos usando signed URL.

### 5) SQL hardening (migracion)
Archivo: `supabase/migrations/20260318123000_security_privacy_hardening.sql`

- **Constraints/Integridad**:
  - checks de estado/rol/rangos y no negativos;
  - FKs endurecidas (ownership y cascadas controladas);
  - indice unico `registrations(tournament_id, player_id)`;
  - indices de soporte para RLS y consultas por ownership.
- **Funciones helper seguras (SECURITY DEFINER)**:
  - `current_user_role`, `current_user_org_id`, `current_user_is_super_admin`, `is_org_admin`, `is_tournament_admin`.
- **Triggers de seguridad**:
  - prevencion de escalamiento en `profiles`;
  - enforcement server-side en `registrations`;
  - validacion de ganador en `matches`;
  - auditoria de cambios.
- **RLS/Policies**:
  - `profiles`, `organizations`, `tournaments`, `registrations`, `matches`.
- **Storage policies**:
  - bucket `organizations` privado;
  - lectura separada para `logos` y `avatars` (avatars restringidos al owner/super-admin);
  - validacion de extension y tamano en insert/update.
- **Auditoria**:
  - `audit_logs`, indices y politica de lectura solo super-admin;
  - `purge_expired_audit_logs(retention_days)` para retencion tecnica.

## Inventario SQL agregado/ajustado

### Tablas
- `public.audit_logs`

### Funciones
- `public.set_row_updated_at`
- `public.current_user_role`
- `public.current_user_org_id`
- `public.current_user_is_super_admin`
- `public.is_org_admin`
- `public.is_tournament_admin`
- `public.handle_new_auth_user_profile`
- `public.prevent_profile_privilege_escalation`
- `public.clear_push_token_when_disabled`
- `public.registrations_server_enforcer`
- `public.validate_match_winners`
- `public.audit_payload`
- `public.audit_log_changes`
- `public.purge_expired_audit_logs`

### Triggers
- `set_<table>_updated_at` en tablas core
- `trg_auth_user_profile`
- `trg_profiles_prevent_privilege_escalation`
- `trg_profiles_clear_push_token`
- `trg_registrations_server_enforcer`
- `trg_matches_validate_winners`
- `trg_audit_profiles`
- `trg_audit_tournaments`
- `trg_audit_registrations`
- `trg_audit_matches`

### Policies (resumen)
- Core:
  - `profiles_*`, `organizations_*`, `tournaments_*`, `registrations_*`, `matches_*`
- Storage:
  - `organizations_assets_select_logos`
  - `organizations_assets_select_avatars`
  - `organizations_assets_insert_avatars`
  - `organizations_assets_insert_logos`
  - `organizations_assets_update_avatars`
  - `organizations_assets_update_logos`
  - `organizations_assets_delete_avatars`
  - `organizations_assets_delete_logos`
- Auditoria:
  - `audit_logs_select_super_admin`

## Riesgos mitigados
- Escalamiento de privilegios por cliente.
- IDOR/mass assignment en operaciones clave de registro/partidos.
- Exposicion innecesaria de PII (correo en flujos admin, URLs publicas estaticas, logging sensible).
- Debilidad de integridad en estados criticos (`is_paid`, `fee_amount`, ganadores, estado torneo).
- Falta de trazabilidad de cambios sensibles.

## Riesgos pendientes / residuales
- Si `.env` estuvo en historico git, claves anon/public deben rotarse.
- Requiere ejecutar migracion en Supabase y validar compatibilidad con schema real (si existen columnas historicas con nombres legacy).
- Persisten textos con encoding legacy en UI (no de seguridad, si de calidad).
- Revisar tablas no visibles desde este repo (ej. posibles `payments/transactions/notifications` backend-only) para confirmar RLS real en ambiente productivo.
- Se recomienda habilitar monitoreo activo de abuso (rate limiting / WAF / alertas de auth) fuera del alcance del cliente.

## Checklist de verificacion manual
- [ ] Ejecutar migracion SQL en entorno dev/staging.
- [ ] Confirmar que usuarios no admin no pueden abrir rutas admin ni mutar datos admin por API.
- [ ] Confirmar que un jugador no puede alterar `is_paid`, `fee_amount`, ni crear/editar `matches`.
- [ ] Confirmar que `profiles.role`, `profiles.org_id`, `profiles.is_super_admin` no son modificables por no super-admin.
- [ ] Confirmar que bucket `organizations` queda privado y que logos/avatars se renderizan con signed URLs.
- [ ] Confirmar que logout elimina artefactos `selected_org_id` y `selected_org_name`.
- [ ] Validar que no haya service role keys en app movil ni en archivos trackeados.
- [ ] Validar auditoria: inserciones en `audit_logs` para cambios de `profiles/tournaments/registrations/matches`.
- [ ] Programar tarea (cron/edge) para `purge_expired_audit_logs`.
- [ ] Rotar claves supabase si `.env` estuvo comprometido en historial.
