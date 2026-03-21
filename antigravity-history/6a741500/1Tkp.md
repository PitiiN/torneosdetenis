# Production Sanity Check

## 1. Verificación de Build
Debemos asegurar que el proyecto compila sin errores de tipos ni de dependencias.

- [ ] Ejecutar `npm run build` localmente.
- [ ] Verificar que no hay errores de TypeScript (`tsc --noEmit`).
- [ ] Verificar que no hay imports circulares o dependencias faltantes.

## 2. Verificación de Flujos Críticos (Manual)
Como hemos tocado la BBDD y la Auth, debemos probar manualmente:

### Usuario
- [ ] Login (Usuario normal - crear uno nuevo si borramos todos).
- [ ] Crear Reserva (Flujo completo: fecha -> confirmación -> pendiente).
- [ ] "Pagar" reserva (Simulada, enviar comprobante).
- [ ] Ver Mis Reservas (Verificar estados y badges).

### Admin
- [ ] Login (Admin - `jaravena@f2sports.cl`).
- [ ] Ver Calendario (Bloqueos, reservas).
- [ ] Verificación de Pagos (Ver comprobante, Aprobar/Rechazar).
- [ ] Gestión de Bloques (Crear, agrupar, eliminar).

## 3. Estado de la Base de Datos
- [ ] Verificar que el usuario Admin tiene rol 'ADMIN' en `public.user_roles`.
- [ ] Verificar que las políticas RLS permiten leer/escribir `bookings` y `storage`.

## 4. Deploy
Una vez verificado todo:
- [ ] Commit final.
- [ ] Push a rama principal.
