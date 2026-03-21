# Walkthrough - Módulo de Torneos

Se ha implementado el Módulo de Torneos según las pistas visuales proveídas en los documentos HTML, separando correctamente las responsabilidades entre el Administrador y los Alumnos.

## 1. Esquema de Base de Datos
Se creó la migración `create_tournaments_module` en Supabase con las siguientes tablas protegidas por Row Level Security (RLS):
*   `tournaments`
*   `tournament_players`
*   `tournament_matches`

**Nota:** Por motivos de seguridad (RLS), solo administradores pueden crear, modificar o eliminar registros. Los estudiantes (`students`) solo pueden consultar (SELECT) estos datos.

## 2. Vistas de Administrador (`Admin`)
Se habilitó el flujo completo de gestión bajo la ruta `app/(admin)/tournaments/`:

*   **Listado de Torneos**: Reemplaza la vista "Próximamente" por una lista dinámica obtenida de la base de datos que informa del estado (Borrador, En Curso, Finalizado), su categoría y el formato. Posee un botón flotante para crear nuevos torneos.
*   **Creación de Torneo**: Un formulario que permite estructurar la cantidad de jugadores, modalidad y formato. Incluye un buscador modal para seleccionar a alumnos registrados en la plataforma.
*   **Detalle Dinámico / Edición**: Al ingresar a un torneo, muestra las pestañas correspondientes al formato ("Cuadro Principal" vs "Consolación" o "Grupo A" vs "Grupo B"). **Permite** a los administradores presionar los partidos y lanzar un modal para guardar nuevos resultados (`score`).

## 3. Vistas de Estudiantes (`User`)
La vista pública ubicada en `app/(tabs)/tournaments` y su detalle en `app/(tabs)/tournaments/[id].tsx` fue adaptada como un espejo de solo visualización. 
*   Comparte la misma rica estructura visual y tablas provistas en el modelo.
*   **Restricciones**: Se removieron los botones para "Crear Torneo", para "Ajustes/Generar" y se desactivó el modal de edición al tocar un partido. Todos los flujos operan en modo solo-lectura (Read Only).

## Pasos Siguientes sugeridos
*   Realice pruebas creando un "Torneo" como administrador y seleccione algunos alumnos de la base de datos.
*   Asigne algunos resultados (ej. "6-4 6-2") o revise los cuadros generados.
*   Abra la vista de un alumno normal e inspeccione la visibilidad en tiempo real de los resultados editados.
