# PRIVACY GAP REPORT - TorneosDeTenis

## 1) Inventario de datos tratados (detectado en codigo)

| Dominio | Datos | Clasificacion | Criticidad |
|---|---|---|---|
| Cuenta/Auth | `auth.users.id`, credenciales, sesion JWT/refresh | Autenticacion | Alta |
| Perfil usuario | `profiles.id`, `name`, `phone`, `location`, `avatar_url`, `role`, `org_id`, `notifications_enabled`, `expo_push_token` | Personal + Acceso | Alta |
| Organizacion | `organizations.id`, `name`, `slug`, `logo_url` | Interno / Publico controlado | Media |
| Torneos | `tournaments.*` (estado, fechas, formato, nivel, sede, fee) | Operacional | Media |
| Inscripciones | `registrations.player_id`, `status`, `fee_amount`, `is_paid`, `registered_at` | Personal + Financiero | Alta |
| Partidos | `matches.*` (jugadores, marcador, ganador, agenda/cancha) | Operacional + Personal indirecto | Media/Alta |
| Ranking/estadisticas | resultados agregados por usuario | Operacional / Perfil deportivo | Media |
| Notificaciones push | token Expo + payload visible | Personal tecnico | Media |
| Storage (imagenes) | avatares y logos | Personal (avatar) / Institucional (logo) | Media |
| Auditoria | actor, accion, entidad, payload saneado, timestamp | Operacional + Trazabilidad | Alta |

## 2) Exposicion detectada (antes) y brecha de privacidad

1. **Control de privilegios en cliente** (hardcode por correo + chequeos UI):
   - Riesgo: acceso y visibilidad indebida de datos/admin.
2. **Consultas y flujos con datos no minimizados**:
   - Riesgo: traer/mostrar datos no estrictamente necesarios.
3. **Uso de URLs publicas para imagenes**:
   - Riesgo: mayor superficie de exposicion de activos personales (avatar).
4. **Logs y errores potencialmente verbosos**:
   - Riesgo: filtracion de tokens/estado interno.
5. **Sin baseline robusta de auditoria y retencion tecnica**:
   - Riesgo: baja trazabilidad ante incidentes.
6. **`.env` trackeado en git**:
   - Riesgo: compromiso de secretos por historial.

## 3) Medidas aplicadas (implementadas en repositorio)

### Minimización y control de acceso
- Centralizacion de autorizacion en `src/services/accessControl.ts`.
- Eliminacion de hardcodeo de super-admin por correo.
- Guards de acceso en vistas admin y financieras por contexto real de usuario.
- Reduccion de payloads y controles de seleccion de columnas en consultas clave.

### Privacidad de autenticacion/sesion
- `src/services/supabase.ts`: session storage endurecido con SecureStore + limpieza de artefactos de sesion en logout/evento auth.
- Errores de auth sanitizados (`src/services/errorMessages.ts`) para evitar fuga de detalle sensible.

### Storage y exposicion de imagenes
- Persistencia de `avatar_url` y `logo_url` como path interno, no URL publica permanente.
- Resolucion con signed URL (`src/services/storage.ts`) en cliente.
- Validacion de MIME/extensiones/tamano maximo y nombres no predecibles.
- Policies de storage por carpeta y owner/org (bucket privado).

### Integridad y privacidad en DB
- Migracion `supabase/migrations/20260318123000_security_privacy_hardening.sql`:
  - RLS estricta tablas core;
  - triggers de enforcement server-side;
  - constraints/FKs/indices de ownership;
  - tabla `audit_logs` con payload saneado (evita sobrecaptura de PII).

### Secretos y configuracion
- `.env` removido del indice git.
- `.gitignore` endurecido para env/local state.
- `.env.example` con placeholders no sensibles.
- `app.json` con textos de permisos explicitos y minimizados.

## 4) Minimización aplicada (resultado)

- Se elimino dependencia de correo hardcodeado para privilegios.
- Se removio exposicion de email en flujo de busqueda/listado de jugadores en creacion de torneo.
- Se redujo logging sensible (push token).
- Se evita almacenar URLs publicas estaticas para imagenes de usuario/organizacion.
- Se limita lectura de avatars en storage al owner/super-admin.

## 5) Retencion sugerida (tecnica)

- **`audit_logs`**: 365 dias por defecto (ya existe `purge_expired_audit_logs(retention_days)`).
- **Push tokens (`expo_push_token`)**: eliminar al desactivar notificaciones (trigger aplicado); rotar al reinstalar/dispositivo nuevo.
- **Registros de torneo/partidos**: conservar por necesidad deportiva/estadistica; anonimizar en exportes externos.
- **Datos de contacto (`phone`, `location`)**: retener solo mientras la cuenta este activa y exista finalidad operativa.
- **Archivos de perfil/avatar**: mantener solo ultima version activa cuando sea posible (pendiente automatizacion de garbage collection de objetos antiguos).

## 6) Pendientes para cierre total de brecha

- Ejecutar migracion en entorno Supabase real y validar compatibilidad con datos existentes.
- Rotar claves si `.env` estuvo historicamente expuesto.
- Definir y automatizar job de retencion de `audit_logs`.
- Verificar tablas no visibles en este repo (si existen en productivo): `notifications`, `payments`, `transactions`, vistas/functions heredadas.
- Formalizar flujo de eliminacion/anonimizacion por solicitud del titular (DSR) en backend operativo.

## 7) Checklist rapido de privacidad (manual)

- [ ] RLS activa en tablas core y storage.
- [ ] Usuarios no admin no pueden leer/modificar datos de terceros fuera de necesidad funcional.
- [ ] No hay tokens/JWT/PII sensible en logs de app.
- [ ] Avatares/logos no se sirven por URL publica permanente.
- [ ] Logout limpia artefactos locales asociados a contexto organizacional.
- [ ] Existe mecanismo operativo para purga de auditoria y respuesta a solicitudes de eliminacion/rectificacion.
