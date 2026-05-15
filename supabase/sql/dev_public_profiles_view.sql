-- 1. Actualizar la vista de public_profiles para incluir location, mano_dominante y revés
-- Esto permite que el Perfil Público muestre estos datos sin violar las políticas RLS (Row Level Security) de la tabla profiles.

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id,
    name,
    avatar_url,
    location,
    mano_dominante,
    "revés"
FROM public.profiles;

-- 2. Asegurar que los roles necesarios tengan acceso a consultar esta vista
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
