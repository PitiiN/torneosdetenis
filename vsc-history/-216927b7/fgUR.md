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
2. Crear `.env` desde el template:
```bash
cp .env.example .env
```
3. Completar variables en `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Ejecutar

```bash
npx expo start -c
```

## Navegacion actual (MVP)

- Sin sesion: `LoginScreen`
- Con sesion: tabs `Home`, `Torneos`, `Perfil`
- Tab `Admin` visible solo si `profiles.role` es `admin` u `organizer`
