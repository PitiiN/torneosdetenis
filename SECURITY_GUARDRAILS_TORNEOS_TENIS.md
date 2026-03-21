# SECURITY_GUARDRAILS_TORNEOS_TENIS.md

## Propósito

Este documento define las reglas obligatorias de seguridad, privacidad, protección de datos y control de acceso para cualquier cambio futuro en la aplicación de torneos de tenis.

**Toda implementación nueva debe leer este archivo antes de proponer, modificar o generar código.**

Este archivo funciona como baseline obligatorio para:
- Codex
- Google Antigravity
- cualquier agente o asistente que modifique código, SQL, storage, frontend, backend o configuración

La prioridad no es solo que algo “funcione”, sino que funcione **sin romper la lógica de seguridad, privacidad y resguardo de datos ya implementada**.

---

## Instrucción obligatoria para el agente

Antes de implementar cualquier cambio:

1. Leer este documento completo.
2. Revisar el código existente relacionado.
3. Revisar migraciones SQL y policies existentes.
4. Confirmar que el cambio propuesto respeta estas reglas.
5. Si una nueva funcionalidad entra en conflicto con estas reglas, **adaptar la funcionalidad**, no debilitar la seguridad.
6. Nunca asumir que una solución rápida, temporal o visualmente conveniente es aceptable si rompe control de acceso, privacidad o minimización de datos.

---

## Contexto técnico del proyecto

Arquitectura actual:
- Frontend móvil: React Native con Expo
- Lenguaje: TypeScript
- Backend: Supabase
- Base de datos: PostgreSQL
- Autenticación: Supabase Auth con JWT
- Storage: Supabase Storage
- Realtime: Supabase Realtime / WebSockets
- Navegación separada entre:
  - auth
  - entorno jugador
  - entorno admin / organizer

Dominios funcionales principales:
- profiles / users
- organizations
- tournaments
- registrations
- matches
- rankings
- notifications
- payments / payment proofs / transactions si existen
- audit logs
- assets de storage como avatars y logos

---

## Principios base obligatorios

### 1. El frontend no es confiable
- Nunca confiar en datos enviados desde el cliente para decisiones de seguridad.
- Nunca confiar en `user_id`, `role`, `organization_id`, `is_admin`, `is_paid`, `status`, `owner_id` o cualquier flag sensible enviado por frontend.
- Toda validación crítica debe ocurrir en backend, SQL, RLS o funciones seguras.

### 2. Mínimo privilegio
- Cada usuario solo debe ver o modificar lo estrictamente necesario.
- No entregar lecturas amplias “por comodidad”.
- No usar policies del tipo “authenticated can read all”.
- No usar shortcuts inseguros para destrabar una feature.

### 3. Minimización de datos
- No exponer correos, teléfonos, metadata interna o datos personales si no son estrictamente necesarios para la funcionalidad.
- Toda query debe pedir solo las columnas necesarias.
- Evitar `select *` salvo que esté justificado y revisado.

### 4. Bucket privado + signed URLs
- Los assets privados no deben depender de `getPublicUrl()`.
- El bucket `organizations` se trata como privado.
- Los archivos privados deben visualizarse mediante signed URLs temporales cuando corresponda.
- La fuente de verdad debe ser el `path`, no la URL pública.

### 5. RLS primero
- Toda tabla con datos de usuario, negocio, pagos, torneos, registros, resultados o auditoría debe tener RLS correctamente definida.
- Tener RLS activada no basta: las policies deben ser específicas y no permisivas en exceso.
- Cualquier nueva tabla expuesta por Supabase debe evaluarse con RLS desde el inicio.

### 6. Coherencia entre frontend, SQL y storage
- No implementar lógica en frontend que contradiga:
  - policies SQL
  - estructura de paths en storage
  - roles reales
  - ownership real
- Todo cambio de frontend que use Supabase debe respetar el modelo de acceso real del backend.

---

## Reglas obligatorias para nuevas funcionalidades

## A. Nuevas tablas SQL

Si se crea una tabla nueva:
- definir primary key clara
- definir foreign keys correctas
- usar `created_at` y `updated_at` cuando aplique
- agregar constraints (`NOT NULL`, `CHECK`, `UNIQUE`) cuando corresponda
- evaluar índices para columnas usadas por RLS o joins frecuentes
- definir RLS antes de dar por terminada la implementación
- crear policies específicas para `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- documentar ownership y actores permitidos

Nunca dejar una tabla sensible sin RLS “por mientras”.

---

## B. Nuevas columns con datos personales

Si una nueva funcionalidad requiere nuevos datos personales:
- justificar por qué son necesarios
- almacenar solo lo mínimo
- evitar duplicación innecesaria
- separar datos públicos y privados si corresponde
- no exponerlos en listados si no son necesarios
- considerar retención y eventual eliminación

Ejemplos de datos que requieren especial cuidado:
- correo
- teléfono
- identificadores
- medios de pago
- comprobantes
- historial personal
- observaciones internas
- datos de menores si algún día existieran

---

## C. Nuevas queries en frontend

Toda query nueva debe cumplir:
- pedir solo columnas necesarias
- evitar joins que arrastren PII innecesaria
- respetar surfaces públicas seguras si existen
- no usar `select('*')` salvo justificación concreta
- no confiar en ocultar datos solo desde UI
- verificar que la query sigue siendo válida con RLS estricta

Si una pantalla necesita datos públicos, preferir:
- vistas públicas seguras
- tablas públicas minimizadas
- funciones controladas

en vez de leer tablas privadas completas.

---

## D. Nuevos roles o permisos

Si se incorpora una nueva lógica de permisos:
- no resolverla solo en frontend
- no hardcodear correos ni IDs de usuarios para autorizar
- implementar la fuente de verdad en base de datos o funciones seguras
- revisar impacto en RLS
- revisar impacto en navegación, pantallas y acciones permitidas
- documentar claramente quién puede hacer qué

---

## E. Nuevas funciones SQL / RPC

Toda función SQL o RPC:
- debe revisarse como superficie de seguridad
- no debe exponer columnas sensibles innecesarias
- no debe bypassear RLS sin razón muy justificada
- si usa `SECURITY DEFINER`, debe revisarse con extremo cuidado
- debe fijar `search_path` de manera segura si aplica
- debe validar identidad y permisos reales

Nunca crear funciones poderosas “porque es más fácil desde frontend”.

---

## F. Storage privado

Toda nueva funcionalidad que suba archivos debe seguir estas reglas:

### 1. No usar `getPublicUrl()` para assets privados
- Usar signed URLs cuando el bucket sea privado.
- Guardar el path como fuente de verdad.

### 2. Estructura de paths con ownership explícito
Usar carpetas estructuradas según actor o entidad.
Ejemplos:
- `avatars/<user_id>/<filename>`
- `logos/<organization_id>/<filename>`
- `payment-proofs/<user_id>/<filename>`
- `tournaments/<organization_id>/<tournament_id>/<filename>`

No usar paths planos si el modelo de seguridad requiere aislar por owner.

### 3. Validar uploads
Todo upload debe validar:
- tipo MIME permitido
- extensión permitida
- tamaño máximo
- prefijo/path permitido
- ownership real del path

### 4. No exponer archivos ajenos
Un usuario no debe:
- leer archivos ajenos
- subir a paths ajenos
- actualizar archivos ajenos
- borrar archivos ajenos

salvo que su rol real y la policy definida lo permitan de forma explícita.

---

## G. Signed URLs

Las signed URLs deben:
- tener TTL corto
- generarse solo para paths permitidos
- no generarse para prefijos arbitrarios
- no usarse como mecanismo para abrir acceso más allá de lo definido por policy
- estar alineadas con la estructura real del storage

Si una imagen no se visualiza, no resolver volviendo público el bucket.
Corregir:
- path
- policy
- signed URL
- persistencia del path
- lógica de render

---

## H. Pagos, transacciones y comprobantes

Toda funcionalidad ligada a pagos debe tratarse como altamente sensible.

Reglas:
- no confiar estados de pago enviados desde cliente
- no exponer comprobantes libremente
- no exponer montos, referencias o metadata financiera sin autorización real
- auditar cambios de estado relevantes
- restringir acceso por rol y ownership
- validar cualquier webhook o callback si existe
- nunca almacenar datos de tarjeta si no es estrictamente necesario y autorizado por el procesador correspondiente

---

## I. Auditoría

Cualquier cambio relevante en:
- roles
- pagos
- resultados
- estados de inscripción
- torneos
- configuraciones sensibles
- eliminación o modificación de datos importantes

debe considerar auditoría si la operación tiene impacto de seguridad o negocio.

La auditoría debe:
- registrar actor
- fecha/hora
- entidad afectada
- acción realizada
- evitar guardar PII innecesaria en exceso

---

## J. Notificaciones y realtime

Toda funcionalidad nueva de notificaciones o realtime debe respetar:
- segmentación por usuario / organización / torneo según corresponda
- no exponer datos sensibles en payload visible
- no permitir suscripción a eventos ajenos
- no usar canales abiertos si la información es privada
- mantener el principio de contenido mínimo

---

## K. UI / UX y privacidad

La interfaz no debe mostrar por defecto más información de la necesaria.

Evitar:
- correos visibles en listados generales
- teléfonos visibles en pantallas compartidas
- metadata interna visible para usuarios finales
- estados administrativos internos mostrados sin necesidad
- datos personales de terceros accesibles por navegación lateral

---

## L. Logs y debugging

Nunca dejar persistido en producción:
- tokens
- JWT
- correos
- teléfonos
- signed URLs completas si contienen datos sensibles
- payloads completos de usuario
- respuestas sensibles de Supabase

Los logs de debugging deben:
- ser temporales
- ser mínimos
- eliminarse al cerrar la implementación

---

## M. Secrets y configuración

Nunca:
- hardcodear secrets
- subir `.env` reales al repositorio
- usar `service_role` en frontend
- exponer keys sensibles en cliente

Toda configuración nueva debe:
- ir por variables de entorno
- tener `.env.example` seguro
- estar alineada con el entorno correcto
- documentarse si afecta seguridad

---

## N. Compatibilidad con seguridad existente

Cuando implementes algo nuevo, debes revisar expresamente si afecta:
- RLS existente
- policies de storage
- surfaces públicas seguras como `organizations_public` o `public_profiles`
- signed URLs
- guards de acceso
- tablas sensibles no visibles directamente desde UI

Nunca introducir una mejora visual que rompa el modelo de seguridad.

---

## O. Retención y eliminación

Cuando una nueva funcionalidad cree datos persistentes, evaluar:
- cuánto tiempo deben existir
- si requieren limpieza posterior
- si deben poder eliminarse o anonimizarse
- si su retención debe ser auditada

No acumular datos “por si acaso”.

---

## Checklist obligatorio antes de cerrar cualquier cambio

Antes de dar cualquier implementación por terminada, el agente debe verificar y reportar:

### Seguridad
- [ ] No se debilitó RLS existente
- [ ] No se introdujeron lecturas amplias innecesarias
- [ ] No se confió en permisos definidos solo en frontend
- [ ] No se expusieron datos personales adicionales sin justificación
- [ ] No se introdujeron secrets ni keys en cliente
- [ ] No se usó `getPublicUrl()` para assets privados
- [ ] No se rompió la estructura segura de storage paths
- [ ] No se agregaron funciones SQL inseguras
- [ ] No se dejaron logs sensibles

### Datos
- [ ] Se minimizó la data pedida y mostrada
- [ ] Las nuevas columnas/tablas tienen justificación
- [ ] Las queries piden solo columnas necesarias
- [ ] Se respetó ownership y aislamiento por usuario/organización

### SQL / Supabase
- [ ] Toda tabla nueva sensible tiene RLS
- [ ] Las policies nuevas son específicas
- [ ] Los índices relevantes fueron evaluados
- [ ] Storage quedó alineado con policies y paths
- [ ] Signed URLs siguen funcionando según policy

### UX / funcionalidad
- [ ] La feature funciona con las restricciones de seguridad actuales
- [ ] No se solucionó nada volviendo público algo que debe ser privado
- [ ] La visualización de assets privados usa signed URL cuando corresponde

---

## Instrucción de respuesta obligatoria para el agente

Cada vez que se implemente una funcionalidad nueva, la respuesta final debe incluir:

1. Qué archivos fueron modificados
2. Qué tablas, policies o migraciones fueron tocadas
3. Qué impacto tiene el cambio en seguridad y privacidad
4. Qué riesgos fueron evitados
5. Qué validaciones manuales se deben hacer
6. Confirmación explícita de que el cambio respeta este documento

---

## Prompt corto sugerido para usar con Codex o Antigravity

Antes de implementar cualquier cambio, lee primero `SECURITY_GUARDRAILS_TORNEOS_TENIS.md` y úsalo como baseline obligatorio. No propongas soluciones que debiliten RLS, storage privado, signed URLs, mínimo privilegio, minimización de datos o control de acceso real. Cualquier cambio nuevo debe respetar la lógica actual de seguridad, privacidad y resguardo de datos ya implementada en la app.

---

## Prompt largo sugerido para usar con Codex o Antigravity

Antes de implementar cualquier funcionalidad nueva en esta app, debes leer completo el archivo `SECURITY_GUARDRAILS_TORNEOS_TENIS.md` y tratarlo como una restricción obligatoria de arquitectura, seguridad y privacidad.

Quiero que cualquier cambio:
- respete el modelo actual de Supabase con RLS estricta
- respete el uso de bucket privado y signed URLs
- no use `getPublicUrl()` para assets privados
- no introduzca lecturas amplias ni `select *` sin justificar
- no exponga PII innecesaria
- no confíe en permisos definidos solo en frontend
- no hardcodee roles, correos o privilegios
- no rompa la lógica de ownership por `user_id` u `organization_id`
- no introduzca SQL inseguro ni funciones que abran bypass de seguridad
- mantenga minimización de datos y principio de mínimo privilegio

Antes de codificar:
1. revisa el archivo
2. revisa el código relacionado
3. revisa las migraciones y policies impactadas
4. explica brevemente cómo implementarás la funcionalidad respetando estas reglas

Al finalizar:
- indica archivos modificados
- indica cambios en SQL/policies/storage si los hubo
- explica validaciones manuales
- confirma que el cambio quedó alineado con `SECURITY_GUARDRAILS_TORNEOS_TENIS.md`

---

## Regla final

Si alguna feature nueva entra en conflicto con este documento, la feature debe rediseñarse.

No se debe debilitar la seguridad para acelerar desarrollo.
No se debe volver público algo privado para “hacer que funcione”.
No se debe exponer más datos para simplificar una pantalla.
No se debe confiar en el cliente para definir permisos reales.

La seguridad y el resguardo de datos no son un extra: son parte del producto.