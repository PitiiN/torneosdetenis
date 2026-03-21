# 📱 ArriendoCanchas Mobile — Walkthrough

## Resumen

Se configuró **Capacitor** en el proyecto ArriendoCanchas para generar apps nativas para **Android e iOS** con enfoque **Live URL** (la app carga la web de producción dentro de un contenedor nativo).

---

## Archivos Creados/Modificados

### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| [capacitor.config.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/capacitor.config.ts) | Config principal: appId `com.clubf2.arriendocanchas`, Live URL a producción |
| [platform.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/lib/capacitor/platform.ts) | Detección de plataforma (Android/iOS/Web) |
| [pushNotifications.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/lib/capacitor/pushNotifications.ts) | Registro de push tokens, listeners de notificaciones |
| [native.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/lib/capacitor/native.ts) | StatusBar, back button, haptics, share nativo |
| [CapacitorInit.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/CapacitorInit.tsx) | Componente que inicializa todo al cargar la app |
| `android/` | Proyecto Android generado por Capacitor |
| `ios/` | Proyecto iOS generado por Capacitor |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| [package.json](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/package.json) | +11 paquetes Capacitor, +5 scripts (`cap:sync`, `cap:open:*`, etc.) |
| [globals.css](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/globals.css) | Safe areas, touch targets 44px, overscroll fix |
| [layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/layout.tsx) | Integró `<CapacitorInit />`, viewport-fit:cover |
| [.gitignore](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/.gitignore) | Ignora build artifacts nativos |

### Backend (Supabase)

| Recurso | Descripción |
|---------|-------------|
| Tabla `push_tokens` | Almacena tokens FCM por usuario, con RLS y auto-update |
| Edge Function `send-push-notification` | Envía pushes vía FCM, desactiva tokens inválidos |

---

## Validación

✅ `cap sync` ejecutado exitosamente — 7 plugins detectados en Android y iOS
✅ Tabla `push_tokens` creada con RLS policies
✅ Edge Function `send-push-notification` desplegada y activa
✅ Branch `feature/mobile-app` creado (sin afectar código de producción)

---

## 🔜 Próximos Pasos (requieren acción tuya)

### 1. Instalar Android Studio
- Descargar desde [developer.android.com/studio](https://developer.android.com/studio)
- Instalar y abrir Android Studio
- Ejecutar `npm run cap:open:android` para abrir el proyecto
- Correr la app en emulador o dispositivo USB

### 2. Crear proyecto Firebase
- Ir a [console.firebase.google.com](https://console.firebase.google.com)
- Crear proyecto → Agregar app Android con package `com.clubf2.arriendocanchas`
- Descargar `google-services.json` → copiarlo a `android/app/`
- En Firebase, ir a Cloud Messaging → obtener la **Server Key**
- Agregar `FCM_SERVER_KEY` como secret en Supabase (Edge Functions > Secrets)

### 3. Cuentas de tiendas
- **Google Play Console**: $25 USD → [play.google.com/console](https://play.google.com/console)
- **Apple Developer**: $99 USD/año → [developer.apple.com](https://developer.apple.com)

### 4. Ícono y Splash Screen
- Necesitamos el logo de ArriendoCanchas/ClubF2 para generar el ícono de app
