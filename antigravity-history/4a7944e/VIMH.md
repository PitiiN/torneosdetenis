# Capacitor Mobile App - ArriendoCanchas

## Fase 1: Planificación y Preparación
- [x] Investigar estructura actual del proyecto y dependencias SSR
- [x] Definir estrategia de integración Capacitor (Live URL vs Static Export)
- [x] Escribir plan de implementación
- [x] Obtener aprobación del usuario

## Fase 2: Setup Inicial
- [x] Crear rama git `feature/mobile-app`
- [x] Instalar Capacitor y dependencias
- [x] Configurar `capacitor.config.ts`
- [x] Generar proyectos Android e iOS
- [ ] Configurar Firebase para Push Notifications (requiere tu proyecto Firebase)

## Fase 3: Ajustes Mobile-First
- [x] Optimizar UI para táctil (botones, safe areas, splash screen)
- [ ] Crear ícono de app y splash screen
- [x] Ajustar navegación para mobile
- [x] Manejar deep links y status bar

## Fase 4: Push Notifications
- [x] Crear tabla `push_tokens` en Supabase
- [x] Implementar registro de device tokens
- [x] Crear Edge Functions para envío de notificaciones
- [ ] Notificaciones de recordatorio de reservas (requiere Firebase)
- [ ] Notificaciones de pago pendiente (requiere Firebase)

## Fase 5: Testing y Publicación
- [ ] Probar en emulador Android
- [ ] Probar en dispositivo físico
- [ ] Preparar assets para stores (capturas, descripciones)
- [ ] Publicar en Google Play Store
- [ ] Publicar en Apple App Store (requiere Mac)
