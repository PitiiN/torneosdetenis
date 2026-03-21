# Capacitor Mobile App - ArriendoCanchas

## Fase 1: Planificación y Preparación
- [/] Investigar estructura actual del proyecto y dependencias SSR
- [/] Definir estrategia de integración Capacitor (Live URL vs Static Export)
- [/] Escribir plan de implementación
- [ ] Obtener aprobación del usuario

## Fase 2: Setup Inicial
- [ ] Crear rama git `feature/mobile-app`
- [ ] Instalar Capacitor y dependencias
- [ ] Configurar `capacitor.config.ts`
- [ ] Generar proyectos Android e iOS
- [ ] Configurar Firebase para Push Notifications

## Fase 3: Ajustes Mobile-First
- [ ] Optimizar UI para táctil (botones, safe areas, splash screen)
- [ ] Crear ícono de app y splash screen
- [ ] Ajustar navegación para mobile
- [ ] Manejar deep links y status bar

## Fase 4: Push Notifications
- [ ] Crear tabla `push_tokens` en Supabase
- [ ] Implementar registro de device tokens
- [ ] Crear Edge Functions para envío de notificaciones
- [ ] Notificaciones de recordatorio de reservas
- [ ] Notificaciones de pago pendiente

## Fase 5: Testing y Publicación
- [ ] Probar en emulador Android
- [ ] Probar en dispositivo físico
- [ ] Preparar assets para stores (capturas, descripciones)
- [ ] Publicar en Google Play Store
- [ ] Publicar en Apple App Store (requiere Mac)
