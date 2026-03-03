import { corsHeaders, createServiceClient, jsonResponse, requireAdminOrOrganizer } from "../_shared/auth.ts";

type SeedPayload = {
  count: number;
  category_id: string;
  password: string;
  tag: string;
};

function randomLevel() {
  const levels = ["Cuarta", "Tercera", "Honor"];
  return levels[Math.floor(Math.random() * levels.length)];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const serviceClient = createServiceClient(request);

  try {
    await requireAdminOrOrganizer(request, serviceClient);
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: SeedPayload;
  try {
    payload = (await request.json()) as SeedPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const count = Number(payload.count);
  const categoryId = String(payload.category_id ?? "").trim();
  const password = String(payload.password ?? "");
  const tag = String(payload.tag ?? "").trim();

  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return jsonResponse({ error: "count must be integer between 1 and 200" }, 400);
  }
  if (!categoryId) return jsonResponse({ error: "category_id is required" }, 400);
  if (!password || password.length < 8) return jsonResponse({ error: "password is required (>=8)" }, 400);
  if (!tag) return jsonResponse({ error: "tag is required" }, 400);

  const categoryCheck = await serviceClient.from("categories").select("id").eq("id", categoryId).single();
  if (categoryCheck.error || !categoryCheck.data) {
    return jsonResponse({ error: "category_id not found" }, 404);
  }

  const timestamp = Date.now();
  const created: Array<{ email: string; user_id: string }> = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (let i = 1; i <= count; i += 1) {
    const email = `qa_${tag}_${timestamp}_${i}@example.com`;
    const userRes = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { qa_seed: true, qa_tag: tag },
    });

    if (userRes.error || !userRes.data.user) {
      failed.push({ email, error: userRes.error?.message ?? "create user failed" });
      continue;
    }

    const userId = userRes.data.user.id;
    const profileRes = await serviceClient.from("profiles").upsert(
      {
        id: userId,
        full_name: `QA Player ${i}`,
        role: "player",
        level: randomLevel(),
        qa_tag: tag,
      },
      { onConflict: "id" },
    );
    if (profileRes.error) {
      await serviceClient.auth.admin.deleteUser(userId);
      failed.push({ email, error: profileRes.error.message });
      continue;
    }

    const regRes = await serviceClient.from("registrations").upsert(
      {
        category_id: categoryId,
        user_id: userId,
        status: "ACTIVE",
      },
      { onConflict: "category_id,user_id" },
    );
    if (regRes.error) {
      await serviceClient.from("profiles").delete().eq("id", userId);
      await serviceClient.auth.admin.deleteUser(userId);
      failed.push({ email, error: regRes.error.message });
      continue;
    }

    created.push({ email, user_id: userId });
  }

  return jsonResponse({
    count_ok: created.length,
    count_failed: failed.length,
    users: created,
    failed: failed.slice(0, 20),
  });
});
