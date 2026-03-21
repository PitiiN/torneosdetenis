# 🔥 Guía Firebase paso a paso

## Paso 1: Registrar la app Android en Firebase

1. Abre tu proyecto Firebase: [arriendo-canchas-club-f2](https://console.firebase.google.com/u/0/project/arriendo-canchas-club-f2/overview)
2. En la página principal, busca el botón **"Agregar app"** o el **ícono de Android** (robot verde)
   - Si no lo ves, busca un botón con **"+"** junto a "Tus apps" / "Your apps"
3. Selecciona **Android**
4. En el formulario que aparece, ingresa:
   - **Nombre del paquete Android**: `com.clubf2.arriendocanchas` ← **copiar exacto**
   - **Sobrenombre de la app** (opcional): `ArriendoCanchas`
   - **Certificado SHA-1**: déjalo vacío por ahora
5. Haz clic en **"Registrar app"**

---

## Paso 2: Descargar `google-services.json`

1. Después de registrar la app, Firebase te mostrará un botón **"Descargar google-services.json"**
2. **Descarga el archivo** haciendo clic en ese botón
3. **Copia el archivo descargado** a esta carpeta de tu proyecto:

```
ArriendoCanchas/android/app/google-services.json
```

> [!IMPORTANT]
> El archivo debe quedar en `android/app/` (NO en `android/` solo). Si quedó en otra parte, muévelo manualmente.

4. En Firebase, haz clic en **"Siguiente"** → **"Siguiente"** → **"Continuar a la consola"**
   - No necesitas seguir las instrucciones de agregar SDK que muestra (ya lo hizo Capacitor)

---

## Paso 3: Habilitar Cloud Messaging API

1. En el menú lateral izquierdo de Firebase, haz clic en **⚙️ Configuración del proyecto** (ícono de engranaje arriba)
2. Ve a la pestaña **"Cloud Messaging"**
3. Busca la sección **"Cloud Messaging API (V1)"**
   - Si dice **"Habilitada"** → ¡Perfecto, sigue al paso 4!
   - Si dice **"Deshabilitada"** → Haz clic en los **tres puntos** (⋮) al lado y selecciona **"Habilitar"**

---

## Paso 4: Crear una clave de cuenta de servicio

1. En la misma página de **Configuración del proyecto**, ve a la pestaña **"Cuentas de servicio"** / **"Service accounts"**
2. Asegúrate de que esté seleccionado **"Firebase Admin SDK"**
3. Haz clic en **"Generar nueva clave privada"** / **"Generate new private key"**
4. Confirma haciendo clic en **"Generar clave"**
5. Se descargará un archivo `.json` (ej: `arriendo-canchas-club-f2-firebase-adminsdk-xxxxx.json`)

> [!CAUTION]
> Este archivo contiene credenciales privadas. **No lo compartas ni lo subas a Git.** Lo usaremos solo para configurar Supabase.

---

## Paso 5: Agregar las credenciales en Supabase

1. Abre el archivo `.json` que descargaste en el paso 4 con un editor de texto (Notepad)
2. **Copia TODO el contenido del archivo** (Ctrl+A, Ctrl+C)
3. Ve a tu dashboard de Supabase: [supabase.com/dashboard](https://supabase.com/dashboard)
4. Selecciona tu proyecto → Ve al menú lateral → **"Edge Functions"**
5. Haz clic en **"Secrets"** / **"Manage secrets"** (gestionar secretos)
6. Haz clic en **"Add new secret"** y crea este secreto:
   - **Nombre**: `FIREBASE_SERVICE_ACCOUNT`
   - **Valor**: Pega TODO el contenido del archivo JSON que copiaste
7. Haz clic en **"Save"**

---

## ✅ Verificación

Una vez completados todos los pasos, avísame y yo:
1. Verificaré que el `google-services.json` está en su lugar
2. Actualizaré la Edge Function para usar Firebase v1 API
3. Haremos una prueba de build en Android Studio

---

## 📁 Resumen de archivos

| Archivo | Dónde va | Qué es |
|---------|----------|--------|
| `google-services.json` | `android/app/` | Conecta tu app Android con Firebase |
| Archivo `.json` de cuenta de servicio | Supabase Secrets | Permite enviar push notifications desde el servidor |
