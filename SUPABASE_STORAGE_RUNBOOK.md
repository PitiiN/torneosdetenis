# Supabase Storage Runbook (Residual Closure)

## Objetivo
Cerrar el residual donde los bloques de `storage.objects` pudieron quedar en `skip with NOTICE` por falta de ownership durante migraciones, y dejar `storage` validado al 100%.

## Alcance
- `storage.buckets` (bucket `organizations`)
- `storage.objects` (RLS + policies)
- Aislamiento por prefijos:
  - `avatars/{user_uuid}/...`
  - `logos/{organization_uuid}/...`
- Dependencias de policies:
  - `public.current_user_is_super_admin()`
  - `public.is_org_admin(uuid)`

## Prerrequisitos
1. Ejecutar en **staging primero** y luego producción.
2. Usar **Supabase SQL Editor** con rol propietario (normalmente `postgres` en el proyecto).
3. Tener aplicadas migraciones previas de seguridad (primera y segunda pasada).
4. En la barra superior del SQL Editor, cambiar explícitamente `Role` a `postgres` antes de ejecutar remediación.

---

## Paso 1: Diagnóstico inicial (SQL Editor)
Ejecuta:

`supabase/sql/storage_policy_validation_queries.sql`

Qué debes observar:
- Bucket `organizations` existe y `public = false`.
- `storage.objects` con `rowsecurity = true`.
- Existen exactamente estas 8 policies esperadas:
  - `organizations_assets_select_logos`
  - `organizations_assets_select_avatars`
  - `organizations_assets_insert_avatars`
  - `organizations_assets_insert_logos`
  - `organizations_assets_update_avatars`
  - `organizations_assets_update_logos`
  - `organizations_assets_delete_avatars`
  - `organizations_assets_delete_logos`
- Query de “Unexpected / suspicious policies” devuelve 0 filas (o solo policies explícitamente permitidas por tu equipo).

Si algo falla o falta, sigue al Paso 2.

---

## Paso 2: Remediación manual
Ejecuta en SQL Editor:

`supabase/sql/storage_policy_manual_remediation.sql`

Este script:
- asegura bucket `organizations` privado (`public=false`),
- habilita RLS en `storage.objects`,
- elimina policies antiguas/conflictivas,
- recrea el set completo de policies esperadas (idempotente por `drop ... if exists` + `create`).

---

## Paso 3: Validación final
Vuelve a ejecutar:

`supabase/sql/storage_policy_validation_queries.sql`

Criterio de cierre:
- todas las verificaciones del Paso 1 en estado OK,
- sin policies amplias inesperadas,
- sin bucket público accidental.

---

## Paso 4: Pruebas funcionales mínimas (obligatorias)

### Actores de prueba
- `player_a` (Org A)
- `player_b` (Org A)
- `organizer_a` (Org A)
- `organizer_b` (Org B)
- `super_admin`

### Casos a probar
1. **Lectura avatar propio (`player_a`)**
   - Esperado: permitido (signed URL válida / descarga OK).
2. **Lectura avatar ajeno (`player_a` intentando `avatars/player_b/...`)**
   - Esperado: denegado (no signed URL o acceso 401/403).
3. **Lectura logo permitido (`authenticated`)**
   - Esperado: permitido para `logos/{org_uuid}/...`.
4. **Acceso fuera de prefijo permitido**
   - Intentar `misc/...` o key malformada.
   - Esperado: denegado.
5. **Generación signed URL válida**
   - path existente y permitido (`avatars/self/...` o `logos/...` según rol).
   - Esperado: URL válida temporal.
6. **Generación signed URL inválida**
   - path ajeno o prefijo no permitido.
   - Esperado: error/denegación.
7. **Upload logo cross-tenant (`organizer_a` en `logos/{org_b}/...`)**
   - Esperado: denegado.
8. **Upload logo org propia (`organizer_a` en `logos/{org_a}/...`)**
   - Esperado: permitido.

---

## Errores esperables y cómo interpretarlos

1. `must be owner of relation objects` / `must be owner of table objects`
   - Significa que no estás ejecutando como rol propietario de `storage.objects`.
   - Acción: si aparece en la línea `ALTER TABLE ... ENABLE RLS`, no bloquea el cierre si `rls_enabled=true`.
   - El script de remediación ya captura este caso con `NOTICE`.

2. `Missing dependency: public.is_org_admin(uuid)` o `public.current_user_is_super_admin()`
   - Falta migración base.
   - Acción: ejecutar primero migraciones de hardening previas.

3. `policy ... already exists`
   - No debería ocurrir con este script (hace `drop if exists`).
   - Si ocurre por corrida parcial manual, vuelve a ejecutar script completo.

4. Signed URL devuelve error pese a policy OK
   - Validar que el path cumple estructura esperada (`avatars/{uuid}/file.ext` o `logos/{uuid}/file.ext`) y extensión permitida.
   - Validar actor correcto (owner/org-admin/super-admin según caso).

5. `new row violates row-level security policy for table "buckets"`
   - Causa típica: script ejecutado con `Role = authenticated` en SQL Editor.
   - Acción: cambiar `Role` a `postgres` y volver a ejecutar el script completo.

---

## Si ya te falló una ejecución previa
1. Ejecuta `rollback;`
2. Ejecuta nuevamente `supabase/sql/storage_policy_manual_remediation.sql`
3. Ejecuta `supabase/sql/storage_policy_validation_queries.sql`

## Dependencias de app (alineadas)
- `src/services/storage.ts` ya fuerza:
  - prefijos permitidos (`avatars`, `logos`),
  - owner key UUID,
  - extensión permitida (`jpg`, `jpeg`, `png`, `webp`),
  - TTL corta (300s por defecto, acotada).

Esto reduce generación de signed URLs fuera de la política esperada.

---

## Orden exacto recomendado (staging -> producción)
1. `storage_policy_validation_queries.sql` (baseline)
2. `storage_policy_manual_remediation.sql` (fix)
3. `storage_policy_validation_queries.sql` (post-fix)
4. pruebas funcionales por actor
5. repetir en producción

Si los 5 pasos pasan, el residual queda cerrado.
