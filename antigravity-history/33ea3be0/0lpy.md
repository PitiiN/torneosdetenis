# Migración a Arquitectura 100% Móvil (Sin VPS)

El objetivo es eliminar el VPS donde actualmente se aloja Next.js y transformar la aplicación para que viva **únicamente en los dispositivos móviles** (iOS y Android) usando Capacitor, mientras el backend pasa a ser 100% Serverless utilizando la base de datos y Edge Functions de Supabase.

## User Review Required

> [!IMPORTANT]
> Al eliminar el servidor VPS de Next.js, perderemos la capacidad de ejecutar código en nuestro propio servidor Node (API Routes y Middlewares). Todas las operaciones sensibles que antes se hacían en Next.js (como envíos de correos, notificaciones Push o validaciones complejas de base de datos seguras) deberán migrar a **Supabase Edge Functions**. ¿Estás de acuerdo con este cambio?

## Proposed Changes

### 1. Transformación del Frontend (Next.js a Exportación Estática)
Para que el código de Next.js corra nativamente en el celular sin conectarse a un servidor web:
- Modificar `next.config.js` pasando de `output: 'standalone'` a `output: 'export'`.
- Eliminar la dependencia de *React Server Components* que cargan datos dinámicos, pasando a cargarlos en el cliente con componentes `"use client"` haciendo la petición vía la librería de Supabase en Javascript.
- Reemplazar el `middleware.ts` clásico de Next.js por un componente cliente (HOC o Provider) que maneje la protección de rutas redirigiendo a los usuarios si no tienen sesión.

### 2. Migración del Backend (API Routes a Supabase)
Actualmente existen endpoints dentro de `src/app/api` (ej. `/api/admin`, `/api/bookings`).
- **NUEVO**: Crear funciones equivalentes bajo `supabase/functions/` (Edge Functions en Deno) para la lógica que no puede exponerse en el cliente (como comunicarse con Resend para los correos o usar el Service Role de la BD).
- El código de la App móvil reemplazará los `fetch('/api/...')` por `supabase.functions.invoke('funcion')`.

### 3. Seguridad Directa en la Base de Datos (RLS)
Como no habrá un servidor intermediario de Next.js validando peticiones, todos los dispositivos móviles hablarán directo con la API pública de Supabase.
- **Refuerzo RLS**: Debemos asegurar que las políticas de *Row Level Security* de la base de datos existan y sean contundentes para que nadie pueda alterar modificar reservas de terceros usando un token válido.

## Verification Plan

### Manual Verification
- Compilar la aplicación a estático y empaquetar con Capacitor (`npx cap sync`).
- Desplegar en emulador Android/iOS (o tu dispositivo físico de pruebas actual).
- Verificar interceptando red que todas las peticiones (login, grilla, reservas) van únicamente a `[project_id].supabase.co` y no queda ningún rastro del dominio del VPS.
