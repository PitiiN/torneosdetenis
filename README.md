# Torneos de Tenis (Expo + Supabase)

App mobile (Expo SDK 54) para gestion de torneos de tenis.

## Requisitos

- Node.js 20+
- npm 10+

## Setup

1. Instalar dependencias:
```bash
npm install
```
2. Si agregas dependencias nativas, usar Expo install:
```bash
npx expo install @react-native-picker/picker
```
3. Crear `.env` desde el template:
```bash
copy .env.example .env
```
4. Completar variables en `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Migraciones SQL (Supabase)

Se definio estructura en `supabase/migrations`.

Archivo MVP de torneos/categorias/inscripciones:
- `supabase/migrations/20260302113000_tournaments_mvp.sql`

Aplicacion sugerida:
1. Abrir Supabase Dashboard -> SQL Editor.
2. Copiar y ejecutar el contenido del archivo SQL.
3. Verificar que existen tablas `tournaments`, `categories`, `registrations` con RLS activo.

## Ejecutar

```bash
npx expo start -c
```

## Navegacion actual (MVP)

- Sin sesion: `LoginScreen`
- Con sesion: tabs `Home`, `Torneos`, `Perfil`
- Tab `Admin` visible solo si `profiles.role` es `admin` u `organizer`
- `Torneos`: lista torneos/categorias y permite inscribirse en `PENDING_PAYMENT`
- `Admin`: crear torneos, crear categorias y ver inscritos por categoria
