# 🏟️ Arriendo Canchas

Sistema de reservas para canchas deportivas con verificación de pagos.

## ✨ Características

- **Disponibilidad en tiempo real** - Consulta horarios disponibles al instante
- **Reservas por transferencia** - Sube comprobante y confirma tu reserva
- **Panel de administración** - Verifica pagos y gestiona bloqueos
- **Dashboard con gráficos** - Visualiza tendencias y estadísticas
- **Diseño premium** - UI moderna con glassmorphism y efectos glow

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, Glassmorphism
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Charts**: Recharts
- **Deploy**: Docker

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 20+
- npm 10+
- Cuenta de Supabase

### 1. Clonar y configurar

```bash
git clone <repo-url>
cd arriendocanchas
npm install
```

### 2. Variables de entorno

Crea un archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu-url-de-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 🐳 Docker

### Build y ejecutar

```bash
# Build de producción
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=<url> \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<key> \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -t arriendocanchas .

# Ejecutar
docker run -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY=<key> \
  arriendocanchas
```

### Docker Compose

```bash
# Crear .env con las variables
cp .env.example .env

# Levantar servicios
docker compose up -d

# Ver logs
docker compose logs -f
```

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── (dashboard)/      # Rutas protegidas
│   │   ├── admin/        # Panel de administración
│   │   ├── availability/ # Disponibilidad
│   │   ├── bookings/     # Mis reservas
│   │   └── dashboard/    # Dashboard usuario
│   ├── api/              # API routes
│   │   ├── admin/        # APIs de admin
│   │   ├── availability/ # Consulta slots
│   │   └── bookings/     # CRUD reservas
│   └── auth/             # Login/Register
├── components/
│   ├── charts/           # Componentes de gráficos
│   ├── dashboard/        # Layout del dashboard
│   └── ui/               # Componentes base (shadcn)
├── lib/
│   ├── supabase/         # Clientes Supabase
│   └── utils.ts          # Utilidades
└── types/                # TypeScript types
```

## 🔐 Seguridad

- **RLS habilitado** en todas las tablas de Supabase
- **Service Role Key** solo en servidor
- **Bucket privado** para comprobantes de pago
- **Middleware** protege rutas admin

## 📊 Base de Datos

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfiles de usuario |
| `user_roles` | Roles (USER/ADMIN) |
| `fields` | Canchas disponibles |
| `field_schedules` | Horarios por día |
| `bookings` | Reservas |
| `field_blocks` | Bloqueos manuales |

### Estados de reserva

| Estado | Descripción |
|--------|-------------|
| `PENDIENTE_PAGO` | Esperando comprobante |
| `EN_VERIFICACION` | Comprobante subido, pendiente revisión |
| `PAGADA` | Pago verificado ✅ |
| `RECHAZADA` | Pago rechazado ❌ |
| `CANCELADA` | Cancelada por usuario |
| `BLOQUEADA` | Bloqueada por admin |

## 🌐 Deploy

### Vercel

1. Conecta el repositorio
2. Configura variables de entorno
3. Deploy automático en push

### Railway / Render

1. Usa el Dockerfile incluido
2. Configura variables de entorno
3. Puerto: 3000

### VPS con Docker

```bash
# Copiar archivos
scp -r . user@server:/app

# En el servidor
cd /app
docker compose up -d
```

## 📝 Scripts

```bash
npm run dev      # Desarrollo
npm run build    # Build producción
npm run start    # Servidor producción
npm run lint     # Linter
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-feature`)
3. Commit cambios (`git commit -m 'Add nueva feature'`)
4. Push (`git push origin feature/nueva-feature`)
5. Abre un Pull Request

## 📄 Licencia

ISC
