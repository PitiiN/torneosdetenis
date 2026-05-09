-- ==============================================================================
-- SCRIPT DE LIMPIEZA DE PRODUCCIÓN
-- ==============================================================================
-- ADVERTENCIA: Este script borrará irreversiblemente todos los datos de torneos,
-- partidos, resultados, inscripciones, notificaciones y organizaciones.
-- ÚNICAMENTE se conservarán las cuentas de los usuarios (auth.users) y 
-- sus perfiles (public.profiles).
-- 
-- Instrucciones:
-- 1. Ve al Dashboard de Supabase de tu proyecto en producción.
-- 2. Navega a "SQL Editor" en el menú izquierdo.
-- 3. Crea una nueva consulta (New Query), pega todo este código y haz clic en "RUN".
-- ==============================================================================

BEGIN;

-- 1. Borrar todos los partidos (resultados, programación, puntos, llaves, etc.)
DELETE FROM public.matches;

-- 2. Borrar todas las solicitudes de inscripción pendientes
DELETE FROM public.tournament_registration_requests;

-- 3. Borrar todas las inscripciones confirmadas
DELETE FROM public.registrations;

-- 4. Borrar todos los torneos (esto elimina la base de toda la app excepto usuarios)
DELETE FROM public.tournaments;

-- 5. Borrar las organizaciones/clubes
-- Nota: La clave foránea en 'profiles' usa ON DELETE SET NULL, por lo que 
-- los usuarios conservarán sus cuentas, pero ya no pertenecerán a ninguna organización.
DELETE FROM public.organizations;

-- 6. Borrar todas las notificaciones generadas en la app
DELETE FROM public.notifications;

-- 7. Borrar los registros de auditoría/logs de acciones
DELETE FROM public.audit_logs;

-- Confirmar la transacción
COMMIT;
