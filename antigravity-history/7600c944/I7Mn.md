# F2 Sports Management - MVP Plataforma Integral

Este repositorio contiene la arquitectura inicial para la **Super App (Hub)** de F2 Sports Management, desarrollada bajo los lineamientos del SRS proporcionado. La aplicación móvil se construyó usando React Native (Expo) y el backend se preparó utilizando Supabase.

## Arquitectura
- **Frontend**: React Native (Expo Router, TypeScript).
- **Backend/Base de Datos**: Supabase (Autenticación nativa + Postgres + RLS).
- **Gestión de Estado**: Zustand (`useAuthStore`) y React Query (opcional para futuras APIs complejas).
- **Notificaciones**: Tabla `notifications` para in-app persistentes.
- **Auditoría**: Tabla `audit_logs`.

## Supuestos Iniciales
1. No se contaba con una paleta de colores directa, por lo que se definió un **Cyan primario (`#00A3E0`)** asumiendo el tono del logo, acompañado de temas claros/oscuros base.
2. El archivo del Logo para el Splash Screen (`splash.png`) debe reemplazarse físicamente en `app/assets/images/splash.png` si se desea cargar el activo gráfico real de F2. El tiempo de 3s (timeout) ya está implementado en `_layout.tsx`.
3. Para el MVP local, **Supabase** se inicializó en el entorno de carpetas (`supabase/migrations`, `supabase/seed.sql`). Se debe tener [Supabase CLI](https://supabase.com/docs/guides/cli) y Docker corriendo para poder usar las funciones locales.

## Inicialización del Proyecto

### 1. Iniciar Supabase (Backend Local)
1. Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Desde la raíz del repositorio, iniciar la instancia de Supabase:
```bash
npx supabase start
```
3. Esto aplicará automáticamente las migraciones (tablas y políticas de RLS) ubicadas en `supabase/migrations/` y ejecutará los seeds en `supabase/seed.sql` (creando los 7 productos base).

### 2. Iniciar React Native (Expo App)
1. Cambiar al directorio frontend:
```bash
cd app
```
2. Instalar dependencias si no se ha hecho:
```bash
npm install
```
3. Iniciar el servidor de desarrollo de Expo:
```bash
npx expo start
```
4. Podrás escanear el código QR con **Expo Go** o apretar "a" para Android / "i" para iOS emulator.

### 3. Variables de Entorno (Frontend)
El archivo `app/lib/supabase.ts` ya apunta por defecto a `http://127.0.0.1:54321` si corre localhost. Si trabajas con redes simuladas (como en un celular real con Expo Go por Wi-Fi), deberás utilizar tu IP de red local (ej. `192.168.1.XX:54321`) y exportarlo en un `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.XX:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=ey... (tu clave anon key que arroja supabase start)
```

## Resumen de Criterios Completados
✅ Splash Screen estructurado a mínimo 3 segundos.  
✅ Hub de Productos implementado con filtro automático manejado por Row Level Security (RLS) en Supabase (solo muestras productos con membresía).  
✅ Detalle de Producto Contextual (menús diferenciados programados en `[id].tsx` dependiendo si eres `admin`, `staff` o `user`).  
✅ Auditoría vía función utilitaria integrada en backend UI + logs RLS.  
✅ Notificaciones estructuradas con interfaz "Leídas/No Leídas".  

Para más detalles teóricos, referirse a `SRS_F2SportsManagement_PlataformaIntegral.md`.
