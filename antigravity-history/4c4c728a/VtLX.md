# Implementation Plan - Phase 5: Finanzas, Roles y Créditos Acumulativos

Este plan aborda los refinamientos finales solicitados para la gestión de finanzas, la visualización de alumnos y la lógica de créditos de clase.

## Proposed Changes

### 1. Historial de Alumnos (Admin)
#### [MODIFY] [students.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/students.tsx)
- Corregir el filtro `filteredEnrollments` para asegurar que las fechas se comparen correctamente.
- Asegurar que `historyMonth` se inicialice correctamente cada vez que se abre el modal o se cambia de mes.

### 2. Finanzas (Admin)
#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/payments.tsx)
- En la pestaña "Historial", no mostrar ningún registro por defecto si no hay una búsqueda activa (`searchQuery`).
- Mantener el filtro de mes/año solo como complemento a la búsqueda o mostrar vacío.

### 3. Roles en Español
#### [MODIFY] [config.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(admin)/config.tsx)
- Cambiar las etiquetas de los roles en el picker de asignación:
  - `student` -> `Alumno`
  - `coach` -> `Profesor`
  - `admin` -> `Admin`
- Mostrar el rol actual del usuario traducido en el listado de búsqueda.

### 4. Créditos Acumulativos (Usuario)
#### [MODIFY] [006_payment_receipts.sql](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/supabase/migrations/006_payment_receipts.sql)
- Actualizar la función `get_student_class_allowance` para que sea acumulativa (tiempo de vida):
  - `total_paid`: Suma de todos los comprobantes aprobados de siempre.
  - `used`: Conteo de todas las inscripciones confirmadas (pasadas y futuras).
  - `remaining`: La diferencia total.
- Esto permitirá que en meses futuros (ej: Abril 2026) sigan apareciendo los créditos comprados anteriormente.

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Eliminar el envío de `p_date` a `get_student_class_allowance` ya que ahora es global.
- Cambiar la etiqueta "Usadas" por algo más genérico si es necesario, o mantenerla entendiendo que son "créditos consumidos".

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. **Admin Alumnos**: Buscar un alumno con clases en diferentes meses y verificar que el filtro de mes dentro de su ficha funcione correctamente.
2. **Finanzas Admin**: Entrar a "Historial" y verificar que esté vacío inicialmente. Buscar un usuario y ver sus registros.
3. **Configuración**: Abrir el asignador de roles y verificar que digan "Alumno", "Profesor", "Admin".
4. **Créditos**: En vista usuario, cambiar a un mes futuro donde no haya pagos y verificar que el contador de "Pagadas" no sea 0 si tienes créditos acumulados.
