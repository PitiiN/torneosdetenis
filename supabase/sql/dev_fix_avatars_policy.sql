-- Script para actualizar la política de visualización de avatares
-- Anteriormente solo permitía ver tu propio avatar, lo que causaba fallos al ver perfiles ajenos.
-- Ahora permite que cualquier usuario autenticado vea los avatares.

BEGIN;

-- 1. Eliminar la política anterior
DROP POLICY IF EXISTS organizations_assets_select_avatars ON storage.objects;

-- 2. Crear nueva política permitiendo lectura pública/autenticada
CREATE POLICY organizations_assets_select_avatars
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'organizations'
  AND (storage.foldername(name))[1] = 'avatars'
);

COMMIT;
