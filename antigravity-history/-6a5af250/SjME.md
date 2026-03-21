# F2 Sports Management - MVP Plan

## Fase 0 — Alineamiento
- [/] Analizar SRS y definir supuestos
- [ ] Presentar plan de implementación y supuestos

## Fase 1 — Base técnica
- [ ] Inicializar proyecto Expo (TypeScript) con Expo Router
- [ ] Configurar Supabase (proyecto local / migrations básicas)
- [ ] Implementar ThemeProvider base (Paleta de colores)

## Fase 2 — Core de plataforma
- [ ] Configurar Auth de Supabase (Login/Reg)
- [ ] Crear pantalla Splash (mínimo 3 segundos) con Logo
- [ ] Implementar Hub de productos con listado adaptativo
- [ ] Product Context (Navegación al detalle del producto dependiendo del rol)

## Fase 3 — Seguridad y datos
- [ ] Migraciones SQL para tablas Core (`profiles`, `products`, `product_memberships`, `audit_logs`, `notifications`)
- [ ] Configurar políticas RLS
- [ ] Seed script para generar los 7 productos
- [ ] Helpers de permisos en el cliente (`lib/permissions.ts`)

## Fase 4 — Notificaciones + auditoría
- [ ] UI de Notificaciones in-app
- [ ] Implementar registro asíncrono en la tabla `audit_logs`

## Fase 5 — QA y cierre
- [ ] Validación de roles en UI (placeholders)
- [ ] Documentación clara en `README.md`
