# AGENTS.md — Tennis Tournament App (Mobile)

## 0) North Star
Construir una app mobile-only para gestionar torneos de tenis de punta a punta:
inscripciones/pagos, cuadros (draws), scheduling de canchas, live scoring en tiempo real,
notificaciones, y dashboard del organizador.

## 1) Non-goals (por ahora)
- No construir versión web pública.
- No construir marketplace de clubes.
- No construir analytics avanzado (solo métricas básicas).
- No multi-deporte (solo tenis).

## 2) Stack & Standards (no negociar)
- Mobile: React Native + Expo (managed workflow) + TypeScript
- State/Data: TanStack Query (React Query) para server state + Zustand para UI state (si hace falta)
- Backend: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- Payments: Stripe (Payment Links o Payment Intents) + Webhooks via Supabase Edge Function
- Notifications: Expo Push Notifications + email opcional (fase 2)
- Lint/Format: ESLint + Prettier
- Tests: Vitest/Jest para lógica (scoring/draw/scheduling) + tests mínimos de integración donde aplique

## 3) Repo Structure (sugerida)
- /app (Expo Router) o /src (si se usa React Navigation clásico)
- /src/features (dominios: auth, tournaments, draws, scheduling, matches, admin)
- /src/components
- /src/lib (supabase client, query keys, utils)
- /src/domain (lógica pura: scoring, seeding, tiebreakers, scheduling heuristics)
- /docs (PRD, data model, reglas)
- /supabase (migrations, seed, edge functions)

## 4) Security & Data Rules (obligatorio)
- Activar Row Level Security (RLS) en todas las tablas sensibles.
- Nunca hardcodear secrets; usar .env y secretos de Supabase/Stripe.
- Cualquier endpoint “privilegiado” debe vivir en Edge Functions o bajo políticas RLS estrictas.
- Guardar auditoría mínima para resultados y scheduling (event logs).

## 5) Definition of Done (DoD)
Antes de dar una tarea por terminada:
- `pnpm lint` pasa
- `pnpm typecheck` pasa
- `pnpm test` pasa (al menos unit tests para scoring/draw/scheduling cuando aplique)
- Documentar en README cómo correr la app y configurar env vars

## 6) Working Style
- Cambios pequeños y atómicos. No mega-commits.
- Si una decisión técnica es ambigua, elegir la opción más simple que cumpla el PRD.
- Priorizar un MVP funcional y luego refinar.
- Mantener una lista `docs/TODO.md` con pendientes técnicos descubiertos.

## 7) MVP Milestones (orden recomendado)
1) Auth + Profiles + Roles (player/admin/organizer/referee)
2) Torneos + Categorías + Inscripciones
3) Pagos (Stripe) + estados de inscripción
4) Motor de draws: eliminación directa + round robin + consolación (backdraw) + seeding
5) Scoring: validación reglas de tenis + actualización realtime
6) Scheduling: asignación básica + conflictos + estados de cancha
7) Dashboard organizer: finanzas básicas + comunicación masiva + gestión en vivo
8) Notificaciones push (partido en 15 min, cambios, suspensiones)

## 8) Environment Variables (mínimo)
- EXPO_PUBLIC_SUPABASE_URL=
- EXPO_PUBLIC_SUPABASE_ANON_KEY=
- STRIPE_SECRET_KEY= (solo server/edge)
- STRIPE_WEBHOOK_SECRET= (solo server/edge)
- EXPO_PUSH_ACCESS_TOKEN= (si aplica)