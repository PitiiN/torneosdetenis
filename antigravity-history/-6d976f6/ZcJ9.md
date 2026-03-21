# Reestructuración de Clases — Walkthrough

## Cambios Realizados

### 1. Dashboard — Popup Actualizado
**Archivo:** [dashboard.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/dashboard.tsx)

- ❌ Eliminado botón "Bloquear" y función `blockHour`
- ✅ Popup ahora muestra: **Clase Adultos** / **Clase Niños 🏗️** (en construcción) / **Cancelar**
- ✅ Grilla horaria muestra ambas categorías: `Inicial/Avanzado` en vez de una sola

---

### 2. Formulario de Creación — Clase Adultos
**Archivo:** [create.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/create.tsx)

- ❌ Eliminada sección "Profesor" completa (coach picker + modal)
- ✅ Selector de **Categoría por Cancha** (Cancha 1 + Cancha 2), cada una con chips Inicial/Intermedio/Avanzado
- ✅ Cupos máximos por defecto: 12 (6 por cancha)
- ✅ `coach_id` se envía como `null`

---

### 3. Edición de Clase
**Archivo:** [(admin)/classes/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/classes/[id].tsx)

- ❌ Eliminada sección "Profesor"
- ✅ Selector dual de categoría por cancha
- ✅ Admin puede agregar alumnos manualmente sin restricción de categoría

---

### 4. Vista del Alumno — Restricciones
**Archivo:** [class/[id].tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/class/[id].tsx)

- ✅ Badges duales mostrando categoría de Cancha 1 y Cancha 2
- ✅ **Restricción**: usuarios "Inicial" NO pueden inscribirse si ambas canchas son Intermedio/Avanzado
- ✅ Usuarios "Intermedio" y "Avanzado" pueden inscribirse en cualquier clase
- ✅ Banner de advertencia para clases auto-canceladas
- ✅ Botón **"Solicitar Inscripción"** para clases auto-canceladas → crea una solicitud en `student_requests`

---

### 5. Admin — Categoría del Alumno
**Archivo:** [students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)

- ✅ Selector de categoría (Inicial/Intermedio/Avanzado) en el modal de detalle del alumno
- ✅ Se guarda junto con la fecha de incorporación al presionar el icono de guardar

---

### 6. Edge Function — Auto-cancelación
**Archivo:** [auto-cancel-classes/index.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/supabase/functions/auto-cancel-classes/index.ts)

- ✅ Busca clases del día con < 3 inscritos
- ✅ Cancela enrollments y marca la clase como `auto_cancelled = true`
- ✅ Envía notificación push (Expo) e in-app a los alumnos afectados
- ✅ Protegida con `x-cron-secret` header

---

### 7. Migration SQL
**Archivo:** [010_class_overhaul.sql](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/supabase/migrations/010_class_overhaul.sql)

- Categorías actualizadas: Inicial (verde), Intermedio (amarillo), Avanzado (rojo)
- `profiles.student_category` agregado
- `classes.coach_id` → nullable
- `classes.court2_category_id` → referencia a `class_categories`
- `classes.auto_cancelled` → boolean
- Vista `classes_with_availability` actualizada con `court2_category_*`

---

## Pasos Manuales Requeridos

> [!IMPORTANT]
> 1. **Ejecutar la migración SQL** `010_class_overhaul.sql` en el SQL Editor de Supabase
> 2. **Desplegar Edge Function** con: `supabase functions deploy auto-cancel-classes --no-verify-jwt`
> 3. **Configurar cron** externo (ej: cron-job.org) para invocar la Edge Function diariamente a las 7:00 AM Chile

## Verificación
- ✅ TypeScript compila sin errores (exit code 0)
