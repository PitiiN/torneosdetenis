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
- `supabase/migrations/20260302123000_categories_price_fields.sql`
- `supabase/migrations/20260302143000_manual_payment_proofs.sql`

Aplicacion sugerida:
1. Abrir Supabase Dashboard -> SQL Editor.
2. Copiar y ejecutar el contenido del archivo SQL.
3. Verificar que existen tablas `tournaments`, `categories`, `registrations`, `payment_proofs` con RLS activo.

## Precio por categoria (MVP manual)

- El precio se guarda en `categories.price_amount` (entero en CLP).
- Moneda fija en `categories.currency` con default `clp`.
- Este valor sera usado por Stripe en el ticket de pagos.

## Pagos manuales por transferencia

- Tabla `payment_proofs`: workflow `SUBMITTED -> APPROVED/REJECTED/NEEDS_INFO`.
- Bucket privado de Storage: `payment-proofs` (creado por migracion).
- Convencion de path para archivos: `{user_id}/{registration_id}/{timestamp}.{ext}`.
- Policies:
  - player sube y ve sus comprobantes.
  - admin/organizer ve todos los comprobantes.
- Al aprobar desde Admin (`review_payment_proof`), la inscripcion asociada cambia a `registrations.status = ACTIVE`.

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
