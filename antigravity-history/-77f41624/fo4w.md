# Arquitectura y Diseño: Nuevos Módulos JJVV Mobile

Este documento detalla el diseño conceptual, los esquemas de datos (JSON) y la gestión de estados para los 4 nuevos módulos solicitados, enfocados en jerarquía visual, flujos de aprobación y resiliencia.

---

## 1. Módulo: Avisos (Sistema de Hilos Colapsables y Multimedia)

### Diseño (Wireframe Conceptual)
- **Admin**: Formulario limpio con campos: `Título`, `Fecha y Horario` (DatePicker), `Lugar` (Input mapa o texto), y `Descripción`.
- **Usuario**: Lista de tarjetas cronológica.
  - El cuerpo del aviso ocupa la mayor jerarquía visual.
  - En la parte inferior de cada aviso: Botón "💬 Ver X comentarios". (Ocultos por defecto).
  - Al expandir: Animación suave hacia abajo mostrando las burbujas de respuesta.
  - **Multimedia Input**: Barra inferior en el hilo expandido con iconos para `🎤 Voice`, `📷 Cámara/Galería`, y el campo de texto.

### Estructura de Datos (JSON Schema)
```json
{
  "Announcement": {
    "id": "uuid",
    "title": "string",
    "date": "iso-date",
    "schedule": "iso-time",
    "location": "string",
    "body": "string",
    "priority": "normal | important",
    "replyCount": "number",
    "replies": [
      {
        "id": "uuid",
        "userName": "string",
        "message": "string | null",
        "mediaUrl": "url | null",
        "mediaType": "audio | image | video | null",
        "date": "iso-date"
      }
    ]
  }
}
```

---

## 2. Módulo: Encuestas y Consultas (Smart-Polling)

### Diseño (Wireframe Conceptual)
- Tarjetas interactivas en el feed de "Avisos/Consultas".
- Título de la pregunta grande, con la Media (imagen/video) cubriendo el ancho de la tarjeta.
- Botones de radio `( )` o botones anchos para las alternativas.
- Al votar: Transición fluida donde los botones se convierten en barras horizontales (Fill proportion) mostrando porcentajes y cantidad de votos.
- **Admin**: Toggle `[x] Notificar a todos`.

### Estructura de Datos y Notificaciones (JSON Schema)
```json
{
  "Poll": {
    "id": "uuid",
    "question": "string",
    "mediaUrl": "url | null",
    "mediaType": "image | video | audio | null",
    "deadline": "iso-date",
    "options": [
      { "id": "opt-1", "text": "Opción A", "votes": 12 },
      { "id": "opt-2", "text": "Opción B", "votes": 4 }
    ],
    "votedBy": ["user_id_1", "user_id_2"],
    "notifications": {
      "pushEnabled": true,
      "remindersScheduled": [
        { "daysLeft": 3, "status": "sent" },
        { "daysLeft": 2, "status": "pending" },
        { "daysLeft": 1, "status": "pending" }
      ]
    }
  }
}
```

---

## 3. Módulo: Favores (Tablón Estilo "Post-it")

### Diseño (Wireframe Conceptual)
- **Layout**: Cuadrícula asimétrica (Masonry layout) o tarjetas apiladas dinámicamente.
- **Visual**: Tarjetas cuadradas con colores pasteles aleatorios (amarillo, rosa, celeste, verde). Tipografía que simule escritura a mano (opcional) o fuente sans-serif casual. Sombra pronunciada (`elevation: 4`) para dar aspecto 3D.
- **Tarjeta Individual**: Título (bold), Descripción, Autor, y Fecha de creación. Si es el autor original: mostrar ícono de lápiz (Editar) y basurero (Eliminar).
- **Acción Rápida**: Botón flotante "✅ Resuelto" que descarta/archiva la tarjeta con animación de "tirar a la basura" o desvanecer.

---

## 4. Módulo: Gestión de Cuotas (Workflow Financiero)

### Lógica de Estados (State Management)
El flujo de una cuota pasa por una estricta máquina de estados controlada por Zustand (o equivalente).

1. **Estado Inicial**: `PENDING_PAYMENT` (El usuario ve el botón "Pagar").
2. **Pre-Carga**: Usuario selecciona la cuota -> Ve datos bancarios -> Sube foto -> Da clic en enviar.
3. **Transición 1 (Upload)**: Sube archivo. Si falla por peso (>10MB), estado se mantiene en `PENDING_PAYMENT` pero con el modal de `error_handling.upload_limits`.
4. **Transición 2 (A validación)**: Upload exitoso -> Estado cambia a `PENDING_VALIDATION` (El usuario ve "En revisión por admin").
5. **Admin Review**: Admin ve solicitud.
   - **Caso A (Aprobado)**: Admin aprueba -> Estado global de la cuota cambia instantáneamente a `PAID`. (Zustand actualiza UI del admin y del perfil del usuario).
   - **Caso B (Rechazado)**: Admin rechaza -> Trigger de modal obligatorio para `reason_code` -> Estado cambia a `REJECTED`. Frontend del usuario tiñe la cuota de rojo y habilita botón "Subir nuevo comprobante".

### JSON Schema (Estados Financieros y Errores)
```json
{
  "DuesWorkflow": {
    "statusPaths": ["PENDING_PAYMENT", "PENDING_VALIDATION", "PAID", "REJECTED"],
    "currentState": "PENDING_VALIDATION",
    "receiptUrl": "url | null",
    "rejectionDetails": {
      "reasonCode": "ILLEGIBLE_IMAGE | WRONG_AMOUNT | OTHER | null",
      "adminComment": "string | null",
      "rejectedAt": "iso-date | null"
    }
  },
  "ErrorConfig": {
    "upload_limits": {
      "image_max_size_mb": 10,
      "video_max_size_mb": 50,
      "allowed_formats": [".jpg", ".png", ".pdf", ".mp4", ".mp3"]
    }
  }
}
```

---

## 5. Capa de Validaciones y Resiliencia (UX)

- **Snackbars de Toast**: Límite de 10MB/50MB activará tostador rojo en parte inferior sin bloquear la UI principal.
- **Encuestas Expiradas**: Cada iteración del render verificará `new Date() > poll.deadline`. Si es `true`, el state local deshabilita interacciones inmediatamente y muestra Banner amarillo: "Esta encuesta ha finalizado".
- **Favores - Límite de Edición 24h**: `(new Date() - new Date(favor.createdAt)) > 24 * 60 * 60 * 1000`. Si se cumple, el botón Editar se remueve/deshabilita para campos de contenido, dejando solo opción a marcar como resuelto o eliminar.
- **Favores - Diálogo de Borrado**: ActionSheet de iOS / Dialog de Android nativo pidiendo confirmación de doble paso para borrado.
