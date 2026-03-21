# Escuela de Tenis — MVP

App móvil (iOS/Android) para la gestión de clases y horarios de una escuela de tenis.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React Native + Expo SDK 55 + TypeScript |
| **Navegación** | Expo Router v3 (file-based) |
| **Estado/Queries** | Zustand + React Query |
| **Backend** | Supabase (Auth, Postgres, RLS, Storage) |
| **Formularios** | React Hook Form + Zod |
| **Tokens** | expo-secure-store |

## Estructura del proyecto

```
├── app/                        # Expo Router — pantallas
│   ├── _layout.tsx             # Root layout + Auth Gate
│   ├── (auth)/                 # Stack de autenticación
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                 # Tab navigation
│   │   ├── index.tsx           # Inicio (clases del día)
│   │   ├── schedule.tsx        # Horarios semanales
│   │   ├── my-classes.tsx      # Mis inscripciones
│   │   ├── payments.tsx        # Pagos
│   │   └── profile.tsx         # Perfil
│   ├── (admin)/                # Panel de administración
│   │   ├── dashboard.tsx
│   │   ├── classes/
│   │   ├── students.tsx
│   │   └── payments.tsx
│   ├── class/[id].tsx          # Detalle de clase + inscripción
│   └── notifications.tsx
├── src/
│   ├── hooks/                  # Custom hooks (useAuth)
│   ├── services/               # Servicios Supabase
│   ├── store/                  # Zustand stores
│   └── theme/                  # Tokens de diseño
├── supabase/migrations/        # SQL migrations
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_functions.sql
│   └── 004_seed_data.sql
└── .env.local                  # Variables de entorno (no commiteado)
```

## Configuración

1. Clonar y ejecutar `npm install --legacy-peer-deps`
2. Copiar `.env.example` a `.env.local` y completar las variables
3. Ejecutar `npx expo start`

## Base de datos

Las migraciones ya fueron aplicadas al proyecto Supabase remoto **tbahjhufxmsyldhghhhz**.

### Tablas
- `profiles` — Usuarios (admin, coach, student)
- `courts` — Canchas
- `class_categories` — Categorías de clase (nivel, color)
- `classes` — Clases programadas (anti-overlap por cancha)
- `enrollments` — Inscripciones
- `payment_plans` — Planes de pago
- `payments` — Pagos
- `notifications` — Notificaciones
- `class_reschedules` — Reagendamientos (lluvia)
- `student_credits` — Créditos (v1.1)

### Seguridad (RLS)
Todas las tablas tienen RLS habilitado con políticas basadas en roles usando la función `get_my_role()`.

### Funciones
- `handle_new_user()` — Trigger que crea perfil automáticamente al registrarse
- `get_available_classes()` — RPC para clases disponibles en rango de fechas
- `get_student_payment_summary()` — Resumen de pagos del alumno

## Supuestos

1. Los pagos se registran manualmente por el admin (no hay pasarela online en MVP).
2. El primer usuario admin se crea manualmente cambiando el rol en la BD.
3. Las notificaciones push se implementarán en v1.1 (la estructura de BD ya existe).
4. El reagendamiento por lluvia se registra como un nuevo par de clases (original → reemplazo).
5. La recurrencia de clases se difiere a v1.1.
