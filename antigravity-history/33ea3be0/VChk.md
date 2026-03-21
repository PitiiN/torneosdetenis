# Migración 100% Nativa (React Native / Expo)

El objetivo es construir una nueva aplicación móvil utilizando **React Native y Expo**, conectándose directamente a tu base de datos y backend actual en Supabase. 

Este enfoque abandonará Capacitor y las vistas web (Next.js), ofreciendo la mejor experiencia de usuario posible (animaciones fluidas, componentes nativos y alto rendimiento).

## User Review Required

> [!CAUTION]
> **Reescritura del Frontend:** Esta estrategia implica que debemos recrear las vistas y componentes de la aplicación desde cero utilizando componentes de React Native (Ej: reemplazar `<div>` por `<View>`). 
> 
> **¿Estructura del Proyecto:** Crearémos una nueva carpeta (ej: `app-mobile/`) dentro de tu directorio actual para albergar el proyecto Expo, para que no interfiera con tu web actual en Next.js. ¿Estás de acuerdo con esto?

## Proposed Changes

### 1. Inicialización del Nuevo Proyecto Móvil
Crearemos un proyecto utilizando `create-expo-app`. Usaremos **Expo Router** para manejar la navegación entre pantallas (Stacks y Tabs), lo que nos dará un enrutamiento muy similar al App Router de Next.js pero nativo.

### 2. Conexión Backend y Lógica (Supabase)
La base de datos seguirá siendo exactamente la misma. Podremos reciclar la gran mayoría de las "queries" (consultas) de Supabase escritas en Javascript.
- Configuraremos el cliente de Supabase optimizado para React Native (`@supabase/supabase-js` + `AsyncStorage` para mantener la sesión abierta).

### 3. Migración de Rutas Seguras (Edge Functions)
Actualmente existen endpoints dentro de `src/app/api` en tu proyecto Next.js (ej. `/api/admin`, `/api/bookings`).
- **NUEVO**: Crear funciones equivalentes bajo la carpeta `supabase/functions/` (Edge Functions en Deno) para la lógica que no puede exponerse en la app (como comunicarse con Resend para los correos o tareas de administración usando el Service Role Key).
- La App móvil Expo reemplazará los llamados webs `fetch('/api/...')` por `supabase.functions.invoke('nombrefuncion')`.

### Implementación de Splash Screen y Selección de Canchas

Este ajuste incluye una nueva pantalla de inicio animada, una grilla de selección de canchas personalizada y un sistema de permisos gestionado por el administrador.

## User Review Required

> [!IMPORTANT]
> Se requiere que el video `logoF2Club.mp4` esté presente en la raíz o carpeta de assets del proyecto para la Splash Screen.

## Proposed Changes

### [Componentes y Pantallas]

#### [NEW] [index.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/app-mobile/app/index.tsx)
Pantalla de carga con video `logoF2Club.mp4` y botón "Saltar". Redirige al Login.

#### [NEW] [fields.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/app-mobile/app/(tabs)/fields.tsx)
Grilla de 2 columnas con las canchas solicitadas (Huelén, Tabancura, etc.). Solo "Huelén" y "Tabancura" serán funcionales inicialmente.

#### [NEW] [permissions.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/app-mobile/app/admin/permissions.tsx)
Pantalla para que el Admin gestione qué usuarios pueden ver qué canchas.

#### [MODIFY] [_layout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/app-mobile/app/(tabs)/_layout.tsx)
Agregar la nueva pestaña "Canchas" y configurar la navegación inicial.

### [Base de Datos]

#### [SQL] Migración de Permisos
Crear tabla `field_access` para manejar la visibilidad de canchas por usuario.

## Verification Plan

### Manual Verification
- Verificar que el video se reproduce en el inicio.
- Comprobar que el botón "Saltar" funciona.
- Validar que la grilla de canchas muestra 2 por fila.
- Confirmar que solo Huelén y Tabancura permiten navegar al agendamiento.
3.  **Generación de Instaladores (APK/IPA):** Probar el servicio en la nube EAS (Expo Application Services) para compilar las versiones finales de Android e iOS listas para subir a las tiendas.
