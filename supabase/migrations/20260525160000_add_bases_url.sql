ALTER TABLE "public"."organizations" ADD COLUMN IF NOT EXISTS "bases_url" text;

CREATE OR REPLACE VIEW "public"."organizations_public" WITH ("security_barrier"='true') AS
 SELECT "id",
    "name",
    "slug",
    "logo_url",
    "created_at",
    "contact_email",
    "contact_whatsapp",
    "social_links",
    "photos_drive_url",
    "bases_url"
   FROM "public"."organizations" "o";
