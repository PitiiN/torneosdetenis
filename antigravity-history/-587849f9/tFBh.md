# Control Horario - Walkthrough

Aplicación web de control y gestión de horarios laborales desarrollada según el documento SRS y diseño visual.

## ✅ Resumen de Implementación

| Feature | Estado |
|---------|--------|
| Autenticación (Login/Registro) | ✅ Implementado (mock) |
| Dashboard con estadísticas | ✅ Implementado |
| Marcaje entrada/salida | ✅ Implementado |
| Gestión de pausas | ✅ Implementado |
| Timer en tiempo real | ✅ Implementado |
| Gráficos de actividad | ✅ Implementado |
| Historial con filtros | ✅ Implementado |
| Reportes visuales | ✅ Implementado |
| Exportación CSV | ✅ Implementado |

---

## 📁 Estructura del Proyecto

```
AppControlHorario/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css                 # Sistema de diseño
    ├── store/
    │   ├── authStore.js          # Estado de autenticación
    │   └── timeStore.js          # Estado de marcaje y estadísticas
    ├── components/
    │   ├── ui/
    │   │   ├── Button.jsx/css
    │   │   ├── Card.jsx/css
    │   │   ├── Input.jsx/css
    │   │   └── StatCard.jsx/css
    │   └── layout/
    │       ├── Sidebar.jsx/css
    │       ├── Header.jsx/css
    │       └── MainLayout.jsx/css
    └── pages/
        ├── Login.jsx/css
        ├── Register.jsx/css
        ├── Dashboard.jsx/css
        ├── History.jsx/css
        └── Reports.jsx/css
```

---

## 🚀 Instrucciones de Ejecución

### 1. Instalar dependencias
```bash
cd AppControlHorario
npm install
```

### 2. Ejecutar en desarrollo
```bash
npm run dev
```
Abre http://localhost:5173 en tu navegador.

### 3. Credenciales de prueba
Usa cualquier email y contraseña (mínimo 8 caracteres). La aplicación genera datos de ejemplo automáticamente.

---

## 🎨 Diseño Implementado

Basado en el mockup `diseño.png`:

- **Paleta**: Verde lima (#CCFF00) + Negro (#1A1A1A)
- **Tipografía**: Inter (Google Fonts)
- **Sidebar**: Navegación oscura con logo y card promocional
- **Cards**: Bordes redondeados, sombras suaves
- **Gráficos**: Recharts con estilos personalizados

---

## 🔧 Próximos Pasos: Integrar Supabase

1. **Crear proyecto en Supabase**
   - Ir a https://supabase.com
   - Crear nuevo proyecto

2. **Configurar variables de entorno**
   - Copiar `.env.example` a `.env`
   - Agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

3. **Crear tablas según el SRS**
   ```sql
   -- users (usa Supabase Auth)
   -- time_entries
   -- breaks
   -- audit_log
   ```

4. **Modificar stores para usar Supabase**
   - Reemplazar mock data en `authStore.js`
   - Conectar `timeStore.js` a la base de datos

---

## 📱 Características Técnicas

- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **Estado**: Zustand
- **Gráficos**: Recharts
- **Fechas**: date-fns
- **Iconos**: Lucide React
- **Responsive**: CSS Grid + Flexbox
