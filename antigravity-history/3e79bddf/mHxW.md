# Plan de Implementación (Fase 0 - Alineamiento)

## Resumen de Construcción
Construiré una **Super App (Hub Central)** en React Native (Expo Router + TypeScript) conectada a un backend serverless de Supabase. El objetivo es que los usuarios inicien sesión una vez y vean únicamente los productos/ligas donde tienen acceso activo. Al entrar a un producto, el _Product Context_ ajustará las opciones del menú y operaciones según su rol (Admin, Staff, o Usuario), utilizando una interfaz consistente y placeholders para funcionalidades futuras de negocio.
La base de datos "core" contará con autenticación de Supabase y políticas RLS estrictas para imposibilitar fugas de información entre productos, complementada con registros de auditoría y notificaciones in-app.

## Supuestos Establecidos
1. **Paleta de Colores (Diseño)**: Al no adjuntarse textualmente colores exactos más allá de la imagen, usaré los tonos extraídos del logo provisto de **F2 Sports Management**: Azul/Cyan primario (aprox. `#009FE3`), negro/gris oscuro para texto principal (`#111111`), texto secundario gris (`#666666`) y un fondo limpio blanco (`#FFFFFF` o `#F8F9FA`).
2. **Entorno Backend (Supabase)**: Inicializaré el entorno Supabase de manera **local** (`supabase init`), de modo que el esquema, migraciones RLS, perfiles y las bases de datos de productos puedan correr en tu máquina con `supabase start`. 
3. **Roles e Invitaciones (MVP)**: Durante el MVP, los usuarios podrán registrarse solos, pero el acceso a un producto (_membresías_) será insertado en la base de datos inicialmente por Seeders. En las vistas de UI, los botones "Administrar" aparecerán solo si su rol es `admin` para dicho producto.
4. **Notificaciones Push**: Dado que el documento menciona "push puede quedar stub", implementaré un modelo de notificaciones **In-App** respaldado por una tabla en Postgres. Las interfaces Push nativas/reales se dejarán configuradas a nivel código (con Expo Notifications) pero vacías/comentadas hasta conectar credenciales reales.
5. **Autenticación (Navegación)**: Usaremos un sistema de Auth por JWT vía la SDK de Supabase, que se suscribirá a `onAuthStateChange` para enviar al usuario de manera inmediata a la ventana de Auth si su sesión expira o es nueva.

## Próximos pasos (Fase 1)
Una vez aprobado, inicializaré el proyecto Expo RN + plantillas, levantaré Supabase y aplicaré el `ThemeProvider`.
