import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthorizedUser = {
  id: string;
  role: "admin" | "organizer";
};

export function createServiceClient(request?: Request): SupabaseClient {
  const envSupabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const requestOrigin = request ? new URL(request.url).origin : null;
  const supabaseUrl = requestOrigin ?? envSupabaseUrl;
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdminOrOrganizer(
  request: Request,
  serviceClient: SupabaseClient,
): Promise<AuthorizedUser> {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const userRes = await serviceClient.auth.getUser(jwt);
  const userId = userRes.data.user?.id;
  if (userRes.error || !userId) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const roleRes = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const role = roleRes.data?.role;
  if (roleRes.error || (role !== "admin" && role !== "organizer")) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  return { id: userId, role };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
