-- =============================================
-- Tabla: organization_admins
-- Permite asociar administradores a múltiples organizaciones.
-- =============================================

CREATE TABLE IF NOT EXISTS "public"."organization_admins" (
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "org_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("user_id", "org_id")
);

-- Habilitar RLS
ALTER TABLE "public"."organization_admins" ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para organization_admins
CREATE POLICY "organization_admins_select"
    ON "public"."organization_admins"
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.current_user_is_super_admin());

CREATE POLICY "organization_admins_insert"
    ON "public"."organization_admins"
    FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_is_super_admin());

CREATE POLICY "organization_admins_delete"
    ON "public"."organization_admins"
    FOR DELETE
    TO authenticated
    USING (public.current_user_is_super_admin());

-- Migrar datos existentes de profiles
INSERT INTO "public"."organization_admins" ("user_id", "org_id")
SELECT "id", "org_id"
FROM "public"."profiles"
WHERE ("role" = 'admin' OR "role" = 'organizer') AND "org_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Redefinir la función is_org_admin para que use la nueva tabla
CREATE OR REPLACE FUNCTION "public"."is_org_admin"("org_id_input" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    auth.uid() is not null
    and (
      public.current_user_is_super_admin()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'organizer')
      )
      and exists (
        select 1
        from public.organization_admins oa
        where oa.user_id = auth.uid()
          and oa.org_id = org_id_input
      )
    );
$$;

-- Actualizar la política profiles_select_policy para permitir a administradores
-- ver perfiles de su club usando is_org_admin
DROP POLICY IF EXISTS "profiles_select_policy" ON "public"."profiles";
CREATE POLICY "profiles_select_policy" ON "public"."profiles" FOR SELECT TO "authenticated" 
USING (
    ("id" = "auth"."uid"()) 
    OR "public"."current_user_is_super_admin"() 
    OR (
        ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'organizer'::"text"])) 
        AND ("org_id" IS NOT NULL AND "public"."is_org_admin"("org_id"))
    )
);

-- Permisos de tabla
GRANT ALL ON TABLE "public"."organization_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_admins" TO "service_role";
