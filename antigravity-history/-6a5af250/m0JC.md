# F2 Sports Management - MVP Plan

## Fase 0 — Alineamiento
- [x] Analizar SRS y definir supuestos
- [x] Presentar plan de implementación y supuestos

## Fase 1 — Base técnica
- [x] Inicializar proyecto Expo (TypeScript) con Expo Router
- [x] Configurar Supabase (proyecto local / migrations básicas)
- [x] Implementar ThemeProvider base (Paleta de colores)

## Fase 2 — Core de plataforma
- [x] Configurar Auth de Supabase (Login/Reg)
- [x] Crear pantalla Splash (mínimo 3 segundos) con Logo
- [x] Implementar Hub de productos con listado adaptativo
- [x] Product Context (Navegación al detalle del producto dependiendo del rol)

## Fase 3 — Seguridad y datos
- [x] Migraciones SQL para tablas Core (`profiles`, `products`, `product_memberships`, `audit_logs`, `notifications`)
- [x] Configurar políticas RLS
- [x] Seed script para generar los 7 productos
- [x] Helpers de permisos en el cliente (`lib/permissions.ts`)

## Fase 4 — Notificaciones + auditoría
- [x] UI de Notificaciones in-app
- [x] Implementar registro asíncrono en la tabla `audit_logs`

## Fase 5 — QA y cierre
- [x] Validación de roles en UI (placeholders)
- [x] Documentación clara en `README.md`
