# Task: Admin Dashboard Features

## Planning
- [x] Explore existing admin structure
- [x] Review database schema
- [x] Write implementation plan
- [x] Get user approval

## Implementation
- [x] Admin Availability Page (with multi-day selection)
- [x] BookingEditModal component
- [x] Financial Dashboard Page
- [x] BulkPaymentModal component
- [x] API: PATCH booking endpoint
- [x] API: Bulk payment endpoint
- [x] API: Recurring booking endpoint
- [x] API: Financial stats endpoint
- [x] API: Debtors list endpoint
- [x] API: Users search endpoint
- [x] Admin Availability Page (with multi-day selection)
- [x] BookingEditModal component
- [x] Financial Dashboard Page
- [x] BulkPaymentModal component
- [x] Update navigation menu
- [x] Checkbox UI component
- [x] Admin Panel Refinements (Month selector, removing unused components)
- [x] Admin Panel Selector Styling (Grouping Future/History)
- [x] Implement PatternBookingModal (Rule-based recurring bookings)
- [x] Update Admin Availability Page with new modal
- [x] Refine UI: Remove Seleccion Multiple & Darken Pattern Modal
- [x] Fix Dropdown Transparency Issues (All Selectors)
- [x] Improve Recurring Booking Conflict Handling (Partial Success + 0 Created Feedback)
- [x] Fix Invisible Error Alert in PatternBookingModal
- [x] Fix Schema Relationship Error (Simplified API Query)
- [x] Enforce Field-Specific Time Slots (Huelén :30, others :00)
# Task List

## Active Task
- [/] Standardizing Booking Status Workflow
    - [ ] **PASO 1:** Auditoría de estados (DB vs Código) -> `STATUS_AUDIT.md`
    - [ ] **PASO 2:** Eliminar 'RECHAZADA' y estandarizar DB
    - [x] **PASO 3: Implementar Status Mapping**
    - [x] Crear función shared/utils para mapear estatus de Admin -> User.
    - [x] Reglas: `Pendiente Pago` -> `Hold` (User), `Pagada` -> `Pagada`, `Bloqueada` (Admin) -> `Bloqueada` (Availability) / `Reserved` (User list if assigned).
    - [x] Actualizar vista de usuario (`/bookings`, `/dashboard`) para usar este mapeo.

- [x] **PASO 4: Implementar Expiración HOLD**
    - [x] Asegurar que reservas `status='PENDIENTE_PAGO'` > 10 mins liberen disponibilidad.
    - [x] Validar lógica en endpoint de disponibilidad.

- [x] **PASO 5: Revisar Permisos y Transiciones**
    - [x] Asegurar que el usuario pueda pasar de `Hold` -> `Pagada` (vía flow pago) o `Cancelada`.
    - [x] Verificar RLS final.

- [/] **PASO 6: Testing**
    - [x] Crear `TEST_STATUS_FLOW.md` con pasos manuales.
    - [ ] Ejecutar prueba manual de los 4 escenarios clave (Pendiente, Pagada, Bloqueada, Cancelada).

## Completed Tasks
- [x] Clean Up Conflicting "Ghost" Bookings
- [x] Fix Availability Grid Visibility (Removed client-side date filtering)
- [x] Fix Admin Visibility Override (Ignore public "10-min" rule for Admin)
- [x] Verify Huelén 7 Visibility (Found 18:00 bookings outside 18:30 schedule)
- [x] Clean Up Malformed Huelén 7 Bookings
- [x] Fix Public Visibility for Pending Bookings (Show as "Arrendada" & Persist Admin Bookings)
- [x] Fix Individual Booking Visibility (Enforce :30 slots in Edit Modal)
- [x] Fix Admin Grid Labels (Show User Name or 'Admin' instead of 'Editar')
- [x] Disable Weekend Selection for Tabancura (Strict Validation)
- [x] Fix Tabancura Time Slots (Restrict to 19:00, 20:00, 21:00)
- [x] Style 'Blocked' Status in Admin Grid (Purple)
- [x] Fix Redirect Loop (Allow Authenticated Users to Access Login Page)
- [x] Fix User 'Pending' List (Show Admin-created bookings indefinitely)
- [x] Fix Public Availability 'Blocked' Styling (Show Purple for blocked slots) - FIXED CSS CLASS
- [x] Fix Admin Login Redirect (Go to /admin instead of /dashboard)
- [x] Fix Admin Login Redirect (Go to /admin instead of /dashboard)
- [x] Test admin availability view
- [x] Test booking edit functionality
- [x] Test bulk payment operation
- [x] Test financial reports
- [x] Admin Panel Refinements Verification
