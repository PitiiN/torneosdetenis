Vas a trabajar EXCLUSIVAMENTE sobre la app de gestión y organización de Juntas de Vecinos (JJVV).

REGLA CRÍTICA DE CONTEXTO
- No mezclar con otros proyectos.
- Ignorar por completo apps de arriendo de canchas, tenis, reservas deportivas u otros contextos.
- Todo cambio debe respetar la arquitectura, seguridad y privacidad ya endurecidas en esta app JJVV.

RESTRICCIONES NO NEGOCIABLES
No puedes debilitar ni romper ninguna de estas condiciones:

1. Seguridad y acceso
- Mantener aislamiento por organización/JJVV.
- Mantener separación estricta por roles.
- No permitir acceso cruzado entre comunidades.
- No mover autorización sensible a solo frontend/UI.
- No exponer secretos, keys privadas ni service role al cliente.
- No abrir tablas, policies, buckets o funciones por conveniencia.

2. Base de datos y RLS
- Toda tabla sensible debe seguir protegida con RLS.
- No introducir queries, RPCs, views o funciones que bypassen RLS o los controles existentes.
- No crear nuevas tablas sensibles sin políticas de acceso correctas.
- Si agregas o cambias tablas, debes proponer también sus políticas, restricciones e índices.

3. Storage
- Mantener buckets privados cuando corresponda.
- No exponer archivos privados por error.
- No usar URLs públicas para archivos que deben ser privados.
- Si agregas carga de archivos, debes definir acceso por rol y por organización/JJVV.

4. Privacidad
- No agregar recopilación de datos personales innecesarios.
- Minimizar datos.
- Mantener coherencia con la política de privacidad y los disclosures ya definidos.
- Si agregas nuevos datos, permisos del dispositivo o nuevos tratamientos, debes indicarlo explícitamente y proponer qué actualizar en política de privacidad, Data Safety y textos dentro de la app.

5. Calidad del cambio
- Prefiere cambios pequeños, seguros y compatibles con la arquitectura actual.
- No hagas refactors amplios si no son necesarios.
- No rompas flujos existentes.
- Si una mejora requiere comprometer seguridad, debes detenerte y señalarlo.

FORMA DE TRABAJO OBLIGATORIA
Antes de implementar cualquier cambio:
1. Identifica qué módulos, tablas, funciones, pantallas, policies o buckets se verán afectados.
2. Evalúa si el cambio toca seguridad, privacidad, almacenamiento, roles o datos personales.
3. Explica brevemente los riesgos.
4. Recién después propone e implementa.

FORMATO DE RESPUESTA OBLIGATORIO
Responde siempre en este orden:
1. Alcance del cambio
2. Riesgos de seguridad/privacidad afectados
3. Cambios propuestos
4. Cambios aplicados
5. Migraciones SQL necesarias
6. Impacto en política de privacidad / Data Safety / disclosures
7. Validaciones que debo probar manualmente

Si un cambio no afecta privacidad o seguridad, dilo explícitamente.
Si sí afecta, detalla exactamente qué cambia.


Antes de cerrar, valida explícitamente que este cambio:
- no abrió acceso cruzado entre comunidades
- no debilitó RLS
- no dejó autorización sensible solo en frontend
- no expuso archivos privados
- no agregó datos personales sin declararlo
- no introdujo permisos nuevos sin disclosure
- no rompió la coherencia con la política de privacidad actual

Si afecta algo de eso, detállalo y propón el ajuste exacto.


Este cambio podría afectar privacidad o tratamiento de datos.
Quiero que identifiques exactamente:
- qué datos nuevos se recopilan o muestran
- quién los ve
- dónde se almacenan
- si requieren actualización en la política de privacidad
- si requieren cambio en Google Play Data Safety
- si requieren texto adicional dentro de la app

PARA CAMBIOS MENORES
Quiero una revisión de impacto limitada al cambio realizado.
No rehagas auditoría completa.
Valida solo:
- módulos afectados
- tablas afectadas
- RLS afectada
- storage afectado
- roles afectados
- privacidad afectada
- política/Data Safety afectadas


PARA CAMBIOS MAYORES
Realiza una auditoría incremental sobre los cambios recién implementados.
No revises todo el proyecto desde cero.
Concéntrate en:
- archivos modificados
- migraciones nuevas
- nuevas tablas/policies
- nuevos permisos
- nuevos datos personales
- nuevos flujos administrativos