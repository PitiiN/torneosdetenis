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

### 4. Seguridad en la Base de Datos (RLS)
Sigue siendo crucial (como en el plan Capacitor) asegurar que las políticas de *Row Level Security* de la base de datos existan y sean contundentes. Sin el VPS de Next.js, los celulares consultarán directo a Supabase.

### Admin Module [NEW]

Implementation of owner-facing features.

#### [NEW] [admin.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/ArriendoCanchas/app-mobile/app/(tabs)/admin.tsx)
The admin hub and dashboard. Shows business statistics and provides links to management tools.

#### [NEW] [AdminAgenda.tsx](file:///c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/ArriendoCanchas/app-mobile/src/components/admin/AdminAgenda.tsx)
A mobile-optimized version of the availability grid for administrators.

---

## Verification Plan

### Manual Verification
1.  **Ejecución Local:** Ejecutar la app con la aplicación *Expo Go* o el emulador de Android/iOS en tu computadora.
2.  **Flujos Base**: Validar el login, búsqueda de canchas, selección de horas y confirmación de la reserva.
3.  **Generación de Instaladores (APK/IPA):** Probar el servicio en la nube EAS (Expo Application Services) para compilar las versiones finales de Android e iOS listas para subir a las tiendas.
