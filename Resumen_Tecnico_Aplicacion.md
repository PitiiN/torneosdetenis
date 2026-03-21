# Resumen Técnico de la Aplicación — TorneosDeTenis

## 1. Descripción General
**TorneosDeTenis** es una plataforma móvil diseñada para la gestión integral de torneos de tenis amateur y semiprofesional. Conecta a organizadores y jugadores en un ecosistema centralizado que automatiza la creación de cuadros (brackets), la gestión de inscripciones y la actualización de resultados en tiempo real.

---

## 2. Stack Tecnológico

### Frontend (Móvil)
- **Framework**: [React Native](https://reactnative.dev/) con [Expo SDK 54](https://expo.dev/).
- **Enrutamiento**: [Expo Router](https://docs.expo.dev/router/introduction/) (Enrutamiento basado en archivos).
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) para un desarrollo robusto y tipado.
- **UI/Styling**: 
  - Estilos nativos (StyleSheet).
  - Componentes visuales avanzados: `expo-linear-gradient` y `expo-blur`.
  - Iconografía: `@expo/vector-icons` (Lucide, Ionicons, etc.).
- **Gestión de Estado**: Zustand / Context API (según implementación interna).

### Backend & Infraestructura
- **Backend-as-a-Service (BaaS)**: [Supabase](https://supabase.com/).
  - **Base de Datos**: PostgreSQL.
  - **Autenticación**: JWT (JSON Web Tokens).
  - **Realtime**: WebSockets para actualizaciones de marcadores y brackets en vivo.
  - **Storage**: Para almacenamiento de imágenes de perfil y portadas de torneos.
- **Notificaciones**: Expo Notifications integradas con FCM (Firebase Cloud Messaging).

---

## 3. Arquitectura del Proyecto
La aplicación utiliza una estructura modular facilitada por **Expo Router**, dividiendo el acceso por entornos de seguridad:

- **`/app/(auth)`**: Flujos de registro, inicio de sesión y recuperación de contraseña.
- **`/app/(tabs)`**: Entorno principal para el **Jugador**. Incluye torneos, perfil, ranking y pagos personales.
- **`/app/(admin)`**: Panel exclusivo para **Organizadores/Administradores**. Gestión profunda de finanzas y edición técnica de torneos.
- **`/src`**: Servicios de API, tipos de TypeScript, utilidades y componentes compartidos.

---

## 4. Funcionalidades Principales

### Para Jugadores
- **Exploración de Torneos**: Filtrado avanzado por superficie (Arcilla, Dura, Césped), ciudad, nivel de juego y modalidad (Singles/Dobles).
- **Inscripción Digital**: Flujo simplificado para inscribirse en torneos con seguimiento de estado (Pendiente/Confirmado).
- **Visualización de Brackets**: Cuadros de eliminación e interacción con fases de grupos actualizados en tiempo real.
- **Perfil y Estadísticas**: Seguimiento de rendimiento, historial de partidos y ranking interno basado en resultados.
- **Gestión de Pagos**: Historial de transacciones relacionadas con inscripciones y estados de pago.

### Para Organizadores (Admin)
- **Creación de Torneos**: Configuración completa (Formato, Superficie, Categorías, Premios, etc.).
- **Gestión de Cuadros (Brackets)**:
  - Generación automática de llaves (Eliminación simple, Doble, Round Robin).
  - Asignación de cabezas de serie (Seeds).
- **Panel de Control en Vivo**: Actualización de marcadores (sets/puntos) que se refleja instantáneamente en los dispositivos de los jugadores.
- **Gestión Financiera**: Monitoreo de ingresos por inscripciones y trazabilidad de pagos por torneo.
- **Comunicación**: Envío de notificaciones masivas o específicas sobre cambios en la programación.

---

## 5. Modelo de Datos (Core)
- **`users`**: Perfiles con roles diferenciados (`Player`, `Organizer`, `Admin`).
- **`tournaments`**: Entidad central con metadatos de configuración y estados (`Draft`, `Open`, `In Progress`, `Finished`).
- **`registrations`**: Control de participaciones y validación de inscritos.
- **`matches`**: Almacena puntuación, rondas, horarios y estados de los partidos.
- **`notifications`**: Historial de alertas enviadas al usuario.

---

## 6. Características Premium de UI/UX
- **Modo Oscuro/Premium**: Uso de paletas de colores curadas (HSL) con efectos de cristalmorfismo (Glassmorphism).
- **Micro-animaciones**: Transiciones suaves entre estados de carga y feedback interactivo.
- **Optimización de Media**: Selector de imágenes integrado para personalización de perfiles y torneos.

---
*Documento generado técnicamente para la descripción del estado actual del proyecto.*
