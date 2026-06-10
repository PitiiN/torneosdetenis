-- =============================================
-- Tabla: organization_followers
-- Permite a los usuarios seguir organizaciones
-- para recibir notificaciones de nuevos torneos.
-- =============================================

CREATE TABLE IF NOT EXISTS "public"."organization_followers" (
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("user_id", "organization_id")
);

-- Habilitar RLS
ALTER TABLE "public"."organization_followers" ENABLE ROW LEVEL SECURITY;

-- Los usuarios autenticados pueden ver sus propios follows
CREATE POLICY "organization_followers_select_own"
    ON "public"."organization_followers"
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Los usuarios autenticados pueden seguir organizaciones
CREATE POLICY "organization_followers_insert_own"
    ON "public"."organization_followers"
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Los usuarios autenticados pueden dejar de seguir
CREATE POLICY "organization_followers_delete_own"
    ON "public"."organization_followers"
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Los admins y super admins pueden ver todos los seguidores de su org
-- (necesario para enviar notificaciones push)
CREATE POLICY "organization_followers_select_org_admin"
    ON "public"."organization_followers"
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                  coalesce(p.is_super_admin, false)
                  OR p.role = 'super_admin'
                  OR (p.role IN ('admin', 'organizer') AND p.org_id = organization_id)
              )
        )
    );

-- Índice para búsquedas por organización (notificaciones push)
CREATE INDEX IF NOT EXISTS "idx_organization_followers_org_id"
    ON "public"."organization_followers" ("organization_id");

-- Permisos de tabla
GRANT ALL ON TABLE "public"."organization_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_followers" TO "service_role";
