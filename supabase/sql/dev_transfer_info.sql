-- ============================================================
-- Agregar columna transfer_info a la tabla tournaments
-- Esta columna almacena los datos de transferencia bancaria
-- que los jugadores pueden ver al inscribirse.
-- Solo se utiliza en torneos padre (master tournaments).
-- ============================================================

ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS transfer_info TEXT;

COMMENT ON COLUMN public.tournaments.transfer_info IS 'Datos de transferencia bancaria para inscripción. Solo se usa en torneos padre (master).';
