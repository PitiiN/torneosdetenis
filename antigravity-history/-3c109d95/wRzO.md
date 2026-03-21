# Implementación de Solicitudes y Chat

Este plan detalla los pasos para crear el sistema de solicitudes para los alumnos y la bandeja de entrada para los administradores.

## Cambios Propuestos

### 1. Base de Datos (Migración)
Crear dos nuevas tablas para gestionar las solicitudes y sus respuestas (chat):
- **`student_requests`**: 
  - `id` (UUID, primary key)
  - `student_id` (UUID, referencia a perfiles)
  - `reason` (Texto: Sugerencia, Reclamo, Petición)
  - `message` (Texto del mensaje original)
  - `status` (Texto: 'pending' o 'resolved')
  - `created_at`

- **`student_request_replies`**:
  - `id` (UUID, primary key)
  - `request_id` (UUID, referencia a student_requests)
  - `sender_id` (UUID, referencia a perfiles para saber si es el admin o el alumno)
  - `message` (Texto de la respuesta)
  - `created_at`

Se configurará el *Row Level Security* (RLS) para que los alumnos solo puedan ver e interactuar con sus propias solicitudes, mientras que los administradores tendrán acceso completo.

### 2. Interfaz del Alumno (Perfil)
Modificar `app/(tabs)/profile.tsx`:
- Cuando el alumno presione "Solicitud", se abrirá un Modal con dos pestañas:
  1. **Nueva Solicitud**: Formulario con un desplegable para el "Motivo" (Sugerencia, Reclamo, Petición), un campo de texto para el mensaje y botón de enviar.
  2. **Mis Solicitudes**: Lista de las solicitudes enviadas.
- Al tocar una de sus solicitudes, se abrirá una vista de Chat donde podrá ver su mensaje original, las respuestas del administrador y podrá enviar nuevos mensajes.

### 3. Interfaz del Administrador (Alumnos)
Modificar `app/(admin)/students.tsx`:
- Dividir la pantalla verticalmente:
  - Mitad superior: Lista actual de alumnos.
  - Mitad inferior: Bandeja de entrada ("Inbox") de solicitudes.
- **Bandeja de entrada**:
  - Mostrará una insignia (badge) con el número de solicitudes pendientes (`status = 'pending'`).
  - Lista de solicitudes (agrupadas por las más recientes).
- **Modal de Gestión (Chat de Admin)**:
  - Al tocar una solicitud en el Inbox, se abrirá el chat.
  - El administrador podrá escribir y enviar mensajes al alumno.
  - Habrá un botón destacado en rojo o verde para **"Marcar como Resuelta"**.
  - Cuando se marque como resuelta, pasaremos la solicitud a estado 'resolved'. Así **se ocultará/eliminará** automáticamente del Inbox del administrador para mantenerlo limpio, pero sin borrar el historial de la base de datos (por seguridad).

## Plan de Verificación

### Pruebas Manuales
1. Entrar como alumno, abrir el perfil, crear una "Sugerencia" con un mensaje y enviarla. Verificar que aparece en "Mis Solicitudes".
2. Entrar como administrador, ir a la sección "Alumnos" y observar que el Inbox en la parte inferior muestra "1" en el contador.
3. El administrador abre la solicitud, escribe un mensaje de vuelta y lo envía.
4. Volver a la cuenta del alumno y comprobar que puede ver la respuesta del administrador y volver a responder.
5. El administrador presiona "Marcar como Resuelta", verificar que la solicitud desaparece del Inbox.
