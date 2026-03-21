# Implementación de Disparadores Push Reales

Actualmente la aplicación **no está enviando notificaciones push automáticas por sí sola**. El único disparador existente era el botón azul de "Prueba" que acabamos de configurar en la pantalla de Ajustes.

Para que las notificaciones tengan utilidad real para la Junta de Vecinos, debemos conectar la creación de contenido importante con el motor de envíos Push que ya probamos.

## Proposed Changes

La estrategia más efectiva es darle el control al Administrador al momento de crear "Avisos".

### Administrador: Creación de Avisos

Cuando un Admin redacte un Nuevo Aviso en el panel de `ManageAnnouncementsScreen`, agregaremos una opción (un Switch/Casilla) que pregunte: **"¿Enviar Notificación Push a todos los vecinos?"**.

Si el Admin selecciona "Sí" y publica el aviso:
1. El aviso se guarda en la base de datos (comportamiento normal).
2. El sistema toma el Título y el Cuerpo del aviso, localiza los tokens de notificación de todos los usuarios registrados, y dispara silenciosamente una petición a los servidores de Expo (`https://exp.host/--/api/v2/push/send`).
3. Todos los teléfonos de la Villa que tengan la app instalada (el archivo `.apk` final) recibirán la alerta en su pantalla, atrayéndolos a abrir la aplicación para leer la noticia.

#### [MODIFY] `src/screens/admin/ManageAnnouncementsScreen.tsx`
- **UI:** Agregar un componente `Switch` nativo dentro del formulario de creación de Avisos con la etiqueta *"Enviar alerta Push al celular de todos los vecinos"*.
- **Logic:** En la función `handleSave`, luego de guardar el aviso con `addAnnouncement`, verificar el estado del Switch. Si es `true`, invocar una nueva función asíncrona `broadcastPushNotification(title, body)`.

#### [MODIFY] `src/services/pushService.ts`
- **Logic:** Crear y exportar la función `broadcastPushNotification(title, message)`. Esta función deberá obtener virtualmente los tokens de los vecinos (en un entorno Supabase real, esto se hace cruzando la tabla Profiles consultando los Push Tokens guardados. Por ahora simularemos la petición hacia la API unificada si tenemos acceso directo, o mandaremos un array ficticio si el Store no contiene tokens remotos). *Nota técnica: Por privacidad, idealmente los tokens se gestionan vía Edge Functions en el servidor backend.*

### Otras posibles integraciones (Futuro)
Más adelante, se puede replicar esta lógica para que el usuario reciba un Push cuando un Admin responda a su "Solicitud", o cuando su "Pin del Mapa" haya sido aprobado.
