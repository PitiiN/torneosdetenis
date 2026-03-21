# RUNBOOK MVP Multi-Org

## 1) Requisitos
- Node.js 20+
- npm 10+
- Expo CLI via `npx expo`
- Proyecto Supabase con Auth + Storage habilitados

## 2) Variables de entorno
Crear `.env` (sin secretos en git):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## 3) Instalacion
```bash
npm install
```

## 4) Migraciones SQL
Ejecutar en orden (Supabase SQL Editor):
1. `supabase/migrations/20260302113000_tournaments_mvp.sql`
2. `supabase/migrations/20260302123000_categories_price_fields.sql`
3. `supabase/migrations/20260302143000_manual_payment_proofs.sql`
4. `supabase/migrations/20260303102000_profiles_and_registration_cancel.sql`
5. `supabase/migrations/20260303103000_competition_scheduling_notifications.sql`
6. `supabase/migrations/20260303154500_expand_category_levels.sql`
7. `supabase/migrations/20260303190000_multi_org_notifications_ranking.sql`

## 5) Ejecutar app
```bash
npx expo start -c
```

## 6) Calidad local
Correr tipeado de TypeScript:
```bash
npm run typecheck
```
Ejecutar linter:
```bash
npm run lint
```
Correr Unit Tests (Domain Logic) con `tsx`:
```bash
npm run test
```

Build export:
```bash
npm run build
```

## 7) Smoke tests manuales
1. Login como Admin existente.
2. Verificar acceso directo a `AdminTabs` (sin vitrina).
3. En Config Admin, editar nombre del club.
4. En Home Admin, usar CTA `Nuevo Campeonato` y crear torneo en wizard.
5. Confirmar que la estructura se puede guardar con 0 inscritos.
6. Login como Player, elegir organizacion en vitrina (real o demo).
7. En org real, inscribirse en categoria y subir comprobante (PENDING_PAYMENT -> proof SUBMITTED).
8. Volver como Admin, en `Solicitudes/Pagos` aprobar y validar `registration.status = ACTIVE`.
9. En `Notificaciones` Admin crear aviso; como Player marcarlo como leido.
10. En Player `Ranking`, cambiar categoria y validar listado por nivel.

## 8) Checklist de release MVP
- `npm run typecheck` en verde.
- `npm run lint` en verde.
- `npm run test` en verde.
- Auth gate validado (sin sesion => login).
- `admin/organizer` entra directo a AdminTabs.
- `player` pasa por vitrina de organizaciones y seleccion persistida.
- Torneos Player y Torneos Admin con vista separada.
- Solicitudes/Pagos con aprobar/rechazar funcionando.
- Notificaciones DB (`notifications` + `notification_reads`) funcionando.
- Ranking por org + categoria visible.
