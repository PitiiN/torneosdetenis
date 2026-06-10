CREATE OR REPLACE VIEW "public"."public_profiles" WITH ("security_barrier"='true') AS
 SELECT "id",
    COALESCE(NULLIF(TRIM(BOTH FROM "name"), ''::"text"), 'Jugador'::"text") AS "name",
    "avatar_url",
    "location",
    "revés",
    "mano_dominante"
   FROM "public"."profiles" "p";
