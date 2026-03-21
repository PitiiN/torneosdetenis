# Mobile-First UI & Login Improvements

## Proposed Changes

### 1. Hamburger Button — Accesibilidad en Mobile

#### [MODIFY] [DashboardLayout.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/dashboard/DashboardLayout.tsx)

El header mobile actual tiene `top-0` y el contenido usa `pt-20`. En la app móvil, la barra de estado del sistema tapa el botón.

**Cambios:**
- Agregar `pt-[env(safe-area-inset-top)]` al header para respetar el notch/status bar
- Aumentar el tamaño del botón hamburguesa (`min-h-[44px] min-w-[44px]`) para cumplir con Apple touch target guidelines
- Ajustar padding del contenido para acomodar el header en mobile

---

### 2. Columna de Horario Fija en Grid de Disponibilidad

#### [MODIFY] [availability/page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/availability/page.tsx)
#### [MODIFY] [AdminCalendarView.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/components/admin/AdminCalendarView.tsx)

La columna "Hora" ya tiene `sticky left-0` pero le falta `bg-card` (background sólido) para que no se vean las celdas de abajo al hacer scroll horizontal.

**Cambios en ambos archivos:**
- Agregar background opaco (`bg-slate-900/95 backdrop-blur-sm`) a las celdas sticky de "Hora" (thead y tbody)
- Reducir `min-w-[800px]` a `min-w-[600px]` para que en tablets se vea mejor
- Hacer la fuente del día más compacta en mobile (abreviar nombre del día)

---

### 3. Modal de Reserva Responsivo

#### [MODIFY] [availability/page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/availability/page.tsx)

Los modales de "Confirmar Reserva" y "¡Reserva Iniciada!" no tienen ajustes para mobile.

**Cambios:**
- Agregar `items-end sm:items-center` para que en mobile el modal suba desde abajo (bottom sheet pattern)
- Agregar `max-h-[90vh] overflow-y-auto` para que no se salga de pantalla
- Reducir padding en mobile (`p-4 sm:p-6`)
- Asegurar que botones y texto sean legibles en pantallas pequeñas

---

### 4. Eliminar Espacio Vacío en Disponibilidad

#### [MODIFY] [availability/page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/(dashboard)/availability/page.tsx)

Hay espacio vacío tipo lineas `462-464` (success message vacío) y el `flex-1` del layout.

**Cambios:**
- Eliminar el comentario vacío de "Success Message" (líneas 462-464)
- El espacio vacío es del `main` con `flex-1`. Cambiar `min-h-screen` a `min-h-0` en el contenido para que no se estire

---

### 5. Eliminar Link "¿Eres administrador?"

#### [MODIFY] [page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/page.tsx)

Eliminar las líneas 82-87 (footer note con "¿Eres administrador? Accede aquí"). El admin usa el mismo login.

---

### 6. Toggle de Visibilidad de Contraseña

#### [MODIFY] [login/page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/auth/login/page.tsx)
#### [MODIFY] [register/page.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/auth/register/page.tsx)

**Cambios:**
- Agregar estado `showPassword` / `showConfirmPassword`
- Agregar botón con icono `Eye` / `EyeOff` al lado derecho del input
- Cambiar `type` dinámicamente entre `password` y `text`
- Agregar `pr-10` al input para hacer espacio al botón
- Importar `Eye`, `EyeOff` de lucide-react

## Verification Plan

### Visual
- Verificar en browser con viewport mobile (375px) que:
  - El botón hamburguesa es accesible
  - La columna de hora se mantiene fija al scroll horizontal
  - Los modales se ven correctos
  - No hay espacio vacío excesivo
  - El link de admin ya no aparece
  - El toggle de contraseña funciona
