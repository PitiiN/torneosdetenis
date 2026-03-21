# Pasos para Testear la App JJVV Mobile

Ya he generado toda la arquitectura y el código fuente. Para probar la aplicación en tu propio celular (iOS o Android), sigue estos pasos desde tu computadora:

### 1. Preparar el Entorno Local
Dado que el proyecto está dentro de **OneDrive**, es posible que experimentes bloqueos de archivos (error `EPERM`). Si es así, **pausa la sincronización de OneDrive** temporalmente.

Abre una terminal (Símbolo del sistema o PowerShell), navega a la carpeta y asegúrate de que todo esté instalado:
```bash
cd "C:\Users\Asus\OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023\Escritorio\PitiN\Antigravity\JJVV\jjvv-mobile"

npm install
```

### 2. Iniciar el Servidor de Expo
Inicia el empaquetador de React Native:
```bash
npm start
```
*(Nota: Estás usando Node.js v24. Si te da un error de "Stripping types is currently unsupported..." durante este paso (un bug temporal conocido entre Node 22/24 y Expo 52), la recomendación oficial de Expo es **instalar Node.js v20 LTS**, o ejecutar la actualización `npm update expo` habiendo pausado OneDrive temporalmente).*

### 3. Probar en tu Teléfono
1. Descarga la aplicación **Expo Go** desde la App Store (iOS) o Google Play (Android).
2. Con tu teléfono conectado a la **misma red Wi-Fi** que tu computadora:
   - **En iPhone:** Abre la aplicación de Cámara y escanea el código QR que aparecerá en tu terminal.
   - **En Android:** Abre la app Expo Go y usa la opción "Scan QR Code".
3. La aplicación se compilará y abrirá en tu celular por primera vez.

### 4. Flujos Clave para Probar (Plan de QA)
- **Registro/Login**: Crea una cuenta nueva. Notarás que al principio solo verás el panel de Usuario normal. 
- **Accesibilidad**: Navega por la app. En la pestaña "Avisos", presiona el botón **"🔊 Escuchar este aviso"** para probar el motor de Text-to-Speech nativo enfocado en los usuarios de tercera edad.
- **Roles de Directiva**: Para ver el panel de Administrador/Directiva creado según documento, accede a `https://supabase.com/dashboard/project/cuwikwegsopfxlubrvsp`, busca la tabla `memberships` en tu base de datos y cambia manualmente tu rol a `'president'`. Luego recarga la app (`r` en la terminal de Expo). Observarás un esquema de colores distintos indicando modo avanzado y estadísticas.
- **Crear Comunicado y S.O.S (Admin/User)**: Prueba los botones de SOS que enlazan dinámicamente (`133`, `131`, `132`).

### 5. Notificaciones Push (Edge Function)
Para que las notificaciones funcionen y puedas recibir alertas:
1. En tu terminal (idealmente PowerShell como Administrador):
```bash
npx supabase login
npx supabase link --project-ref cuwikwegsopfxlubrvsp
npx supabase functions deploy send_push
```
Todo el código de notificaciones Expo por roles está listado en la carpeta `src/services/pushService.ts` y enlazado con la base local de `push_tokens`.
