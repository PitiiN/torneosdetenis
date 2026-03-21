# JJVV Mobile App — Task Checklist

## Phase 1: Project Scaffolding
- [x] Create repo structure `jjvv-mobile/` with required directories
- [x] Initialize Expo app with TypeScript
- [x] Configure NativeWind (Tailwind for RN) + global styles
- [x] Set up environment variables for Supabase
- [x] Configure Supabase client library

## Phase 2: Database & Backend (Supabase)
- [x] SQL Migration 001: Extensions, Enums, Tables, Indexes
- [x] SQL Migration 002: RLS Policies (all tables)
- [x] SQL Migration 003: Helper functions (is_member_of, has_role)
- [x] Storage Buckets + Policies (documents, receipts, gallery, alerts)
- [ ] Edge Function: `send_push`

## Phase 3: Auth & Navigation
- [ ] Auth screens (Login, Register, Reset Password)
- [x] Auth context/provider with Supabase
- [x] Post-login role detection (memberships.role)
- [x] Navigation: UserStack vs AdminStack routing
- [x] Bottom tab navigation for both stacks

## Phase 4: User Screens
- [ ] Home (accesos rápidos)
- [ ] Comunicados (list + TTS button)
- [ ] Emergencias (quick call buttons)
- [ ] Alertas Vecinales (create/view)
- [ ] Agenda/Eventos (list + inscribirse)
- [ ] Tickets (create/follow)
- [ ] Mis Cuotas (status + upload receipt)
- [ ] Biblioteca (documents viewer)
- [ ] Mapa (POIs)
- [ ] Perfil y Preferencias (push, accessibility, font scale)

## Phase 5: Admin Screens
- [ ] Dashboard (KPIs)
- [ ] Comunicados CRUD
- [ ] Alertas Moderación
- [ ] Agenda CRUD + inscritos
- [ ] Tickets Bandeja
- [ ] Socios (altas/aprobaciones)
- [ ] Cuotas/Pagos (tesorería)
- [ ] Finanzas (movimientos + adjuntos + aprobación)
- [ ] Biblioteca Gestión
- [ ] POIs Gestión
- [ ] Auditoría
- [ ] Roles Admin

## Phase 6: Push Notifications
- [ ] Register for push permissions
- [ ] Token registration in push_tokens table
- [ ] Deep links setup (jjvv://ticket/{id})
- [ ] Edge Function integration

## Phase 7: TTS & Accessibility
- [ ] TTS (expo-speech) in announcements
- [ ] Font scale preference
- [ ] High contrast mode
- [ ] Large buttons / simple navigation toggle

## Phase 8: Documentation & QA
- [ ] README with setup instructions
- [ ] EAS build instructions
- [ ] Lint/TypeCheck passing
- [ ] Smoke test validation
