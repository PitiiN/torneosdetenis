# Tareas - Implementación 4 Nuevos Módulos

## 1. Módulo: Avisos (Hilos Colapsables y Multimedia)
- [x] Actualizar schema `Announcement` y `store.ts` para soportar media en respuestas.
- [x] Implementar botón de colapso de hilos ("Ver X comentarios").
- [x] Diseñar UI para input multimedia (icono clip 📎) con validación 10MB/50MB simulada.
- [x] Actualizar pantalla de Admin para crear Avisos (lugar, fecha).

## 2. Módulo: Encuestas (Smart-Polling)
- [x] Definir schema `Poll` en `store.ts` con opciones, votos y deadline.
- [x] Crear componente interaccional UI para feed de Encuestas (barras animadas proporcionales).
- [x] Implementar lógica de validación (encuesta expirada = deshabilitado).
- [x] Formularios de creación (Admin) con toggle de notificación.

## 3. Módulo: Favores (Tablón Post-it)
- [ ] Definir schema `Favor` en `store.ts`.
- [ ] Crear pantalla `FavoresScreen` estilo Tablón Mural (Masonry / Cards orgánicas).
- [ ] Implementar Crear, Editar (bloqueo a las 24 hrs), y Eliminar (con Confirm Dialog).
- [ ] Botón "Resuelto" que oculta/archiva el favor.

## 4. Módulo: Gestión de Cuotas (Flujo Financiero)
- [ ] Actualizar máquina de estados en `MemberDue` (`PENDING_VALIDATION`, `REJECTED`, etc).
- [ ] Pantalla de usuario al pinchar cuota: Info bancaria -> Sube comprobante -> Enviar.
- [ ] Pantalla de Admin (Flujo de validación): Aprobar o Rechazar.
- [ ] Al Rechazar: Modal Obligatorio de Motivo. Cambiar estado a `REJECTED` (UI usuario rojo).

## 5. Pruebas y QA
- [ ] Validar flujos de error (Toast Snackbar límite multimedia).
- [ ] Probar transición de estados en Cuotas.
