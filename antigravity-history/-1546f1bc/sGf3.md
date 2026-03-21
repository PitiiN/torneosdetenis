# Reestructuración Completa de Clases

Cambios mayores en la lógica de creación, categorías, inscripción y una nueva función de auto-cancelación.

## User Review Required

> [!IMPORTANT]
> El mensaje del usuario fue **cortado al final** respecto a la función de "Solicitud" post auto-cancelación. Asumo que el flujo es: el botón "Solicitud" crea una solicitud en `student_requests` pidiendo al admin que lo inscriba manualmente, advirtiendo que no hay alumnos suficientes. **Confirmar si esta interpretación es correcta.**

> [!WARNING]
> La función de auto-cancelación a las 07:00 AM requiere un **cron job** (pg_cron o Supabase Edge Function con cron). Supabase soporta `pg_cron` en planes Pro+. **¿Está habilitado pg_cron en el proyecto, o prefiere una Edge Function con cron?**

> [!IMPORTANT]
> Actualmente `coach_id` tiene restricción `NOT NULL` en la tabla `classes`. Al eliminar la sección de Profesor, necesitamos hacerlo `NULLABLE`. **Confirmar.**

> [!CAUTION]
> El modelo actual asigna UNA cancha por clase. El nuevo modelo pide que las 2 canchas se usen siempre y se asigne una categoría a cada cancha. Hay dos enfoques posibles:
> 1. **Crear 2 clases separadas** (una por cancha) cada vez que el admin crea una "Clase Adultos", cada una con su categoría asignada.
> 2. **Agregar un campo `court2_id` y `court2_category_id`** extra a la tabla `classes`.
>
> Yo recomiendo la **Opción 1** (2 clases independientes por bloque horario), porque es más limpio y no rompe la lógica existente de inscripción por clase. El admin en el popup llenaría Categoría Cancha 1 + Categoría Cancha 2, y se crearían 2 registros. **¿De acuerdo?**

---

## Cambios Propuestos

### 1. Base de Datos

#### [MODIFY] Categorías
- Actualizar los registros de `class_categories`: eliminar "Iniciación", "Básico" y "Competición". Dejar sólo **"Inicial" (level 1)**, **"Intermedio" (level 2)**, **"Avanzado" (level 3)**.

#### [MODIFY] Tabla `profiles`
- Agregar columna `student_category TEXT DEFAULT NULL` para almacenar la categoría del alumno ('Inicial', 'Intermedio', 'Avanzado').

#### [MODIFY] Tabla `classes`
- Hacer `coach_id` nullable (ya no se asigna profesor).
- Agregar columna `auto_cancelled BOOLEAN DEFAULT FALSE` para distinguir clases canceladas automáticamente por mínimo de alumnos.

#### [MODIFY] Vista `classes_with_availability`
- Actualizar para reflejar `coach_id` nullable (cambiar `JOIN` por `LEFT JOIN` en profiles).

---

### 2. Dashboard — Popup de Creación

#### [MODIFY] [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)
- **Eliminar** botón "Bloquear" y función `blockHour`.
- **Cambiar** popup a 3 opciones: "Clase Adultos" (navega a create), "Clase Niños 🏗️" (muestra alert "En construcción"), "Cancelar".

---

### 3. Formulario de Creación — Clase Adultos

#### [MODIFY] [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)
- **Eliminar** sección "Profesor" (coach picker y modal).
- **Eliminar** selector de cancha individual. En su lugar, mostrar:
  - **Cancha 1**: selector de categoría (Inicial/Intermedio/Avanzado).
  - **Cancha 2**: selector de categoría.
- Al crear clase, insertar **2 registros** en `classes`, uno por cancha, cada uno con su categoría asignada.
- El `coach_id` será `null`.
- Categorías se muestran dinámicamente desde `class_categories` (sólo las nuevas 3).

---

### 4. Edición de Clase (Admin)

#### [MODIFY] [(admin)/classes/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/[id].tsx)
- **Eliminar** sección de Profesor, coach modal, y estado/funciones relacionadas.
- Mantener: inscripción manual (admin puede inscribir a cualquier usuario sin restricción de categoría).

---

### 5. Vista del Alumno — Restricción de Categoría

#### [MODIFY] [app/class/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/class/[id].tsx)
- Lógica de inscripción: si `profile.student_category === 'Inicial'`, el botón de inscripción se oculta si la clase es de categoría "Intermedio" o "Avanzado". Mostrar mensaje "Tu categoría no permite inscripción en esta clase".
- Usuarios "Intermedio" y "Avanzado" pueden inscribirse en cualquier clase.
- Si la clase tiene `auto_cancelled = true`: mostrar botón **"Solicitar inscripción"** en lugar de "Inscribirme", que cree una `student_request` con motivo "Petición" y mensaje auto-generado.

---

### 6. Auto-cancelación a las 07:00 AM

#### [NEW] Edge Function `auto-cancel-classes`
- Función que se ejecuta como cron (o invocada desde Supabase cron).
- Busca clases con `status = 'scheduled'` cuya fecha sea **hoy** y cuya cantidad de inscritos confirmados sea **< 3**.
- Para cada una:
  1. Cancela enrollments y devuelve créditos de clase.
  2. Marca la clase con `auto_cancelled = true` y `status = 'scheduled'` (sigue visible pero con 0 inscritos).
  3. Envía notificación push a los alumnos afectados.

---

### 7. Admin — Asignación de Categoría al Alumno

#### [MODIFY] [(admin)/students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)
- En el modal de detalle del alumno, agregar un selector de categoría (Inicial/Intermedio/Avanzado) que actualice `profiles.student_category`.

---

## Verificación

### Prueba Manual
1. **Crear clase**: Como admin, tocar un bloque vacío → ver popup con "Clase Adultos" / "Clase Niños 🏗️" / "Cancelar". Verificar que "Clase Niños" muestre "En construcción" y que "Clase Adultos" navegue al formulario.
2. **Formulario**: Verificar que no aparece sección de Profesor, que se muestran las 2 canchas con selectores de categoría, y que al crear se generan 2 clases.
3. **Restricción de categoría**: Asignar categoría "Inicial" a un alumno, intentar inscribirlo en clase "Avanzado" → debe ser rechazado. Intentar inscribirlo en clase "Inicial" → debe funcionar.
4. **Inscripción manual admin**: Admin agrega manualmente un alumno de categoría "Inicial" en clase "Avanzado" → debe funcionar sin restricción.
5. **Auto-cancelación**: Crear una clase para hoy con < 3 inscritos, ejecutar manualmente la edge function → verificar que los enrollments se cancelen, créditos devueltos, y notificación enviada.
6. **Botón Solicitud**: Después de auto-cancelar, como alumno ver la clase → debe mostrar "Solicitar inscripción" en vez de "Inscribirme".
