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
    - [ ] **PASO 3:** Implementar Mapeo de Estados para Usuario (UI)
        - [ ] Crear helper `getPublicStatus(internalStatus)`
        - [ ] Aplicar en "Mis Reservas"
        - [ ] Aplicar en Dashboard/Cards
    - [ ] **PASO 4:** Expiración de HOLD (10 min)
        - [ ] Verificar implementación actual (cron/check-on-read)
        - [ ] Asegurar liberación de slots
    - [ ] **PASO 5:** Permisos y Reglas de Negocio
    - [ ] **PASO 6:** Verificación (`TEST_STATUS_FLOW.md`)

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
