import { corsHeaders, createServiceClient, jsonResponse, requireAdminOrOrganizer } from "../_shared/auth.ts";

type CleanupPayload = { tag: string };

async function listAllAuthUsersByTag(serviceClient: ReturnType<typeof createServiceClient>, tag: string) {
  const found: Array<{ id: string; email: string }> = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const res = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (res.error) break;

    const users = res.data.users ?? [];
    users.forEach((user) => {
      const email = user.email ?? "";
      if (email.startsWith(`qa_${tag}_`) && email.endsWith("@example.com")) {
        found.push({ id: user.id, email });
      }
    });
    if (users.length < perPage) break;
    page += 1;
  }

  return found;
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

  let payload: CleanupPayload;
  try {
    payload = (await request.json()) as CleanupPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const tag = String(payload.tag ?? "").trim();
  if (!tag) return jsonResponse({ error: "tag is required" }, 400);

  const profileRes = await serviceClient
    .from("profiles")
    .select("id")
    .eq("qa_tag", tag);
  const profileIds = (profileRes.data ?? []).map((row) => row.id as string);

  const authUsers = await listAllAuthUsersByTag(serviceClient, tag);
  const authIds = authUsers.map((u) => u.id);
  const userIds = [...new Set([...profileIds, ...authIds])];
  if (userIds.length === 0) {
    return jsonResponse({ count_deleted: 0, deleted_emails: [] });
  }

  const authEmailById = new Map(authUsers.map((u) => [u.id, u.email]));

  const affectedMatchesRes = await serviceClient
    .from("matches")
    .select("id, draw_id")
    .or(`player1_id.in.(${userIds.join(",")}),player2_id.in.(${userIds.join(",")}),winner_id.in.(${userIds.join(",")})`);
  const affectedDrawIds = [
    ...new Set(((affectedMatchesRes.data ?? []) as Array<{ draw_id: string }>).map((m) => m.draw_id)),
  ];

  await serviceClient.from("registrations").delete().in("user_id", userIds);
  await serviceClient.from("payment_proofs").delete().in("user_id", userIds);
  await serviceClient.from("notifications_outbox").delete().in("user_id", userIds);
  await serviceClient.from("rr_group_members").delete().in("user_id", userIds);

  await serviceClient.from("matches").update({ winner_id: null }).in("winner_id", userIds);
  await serviceClient.from("matches").update({ player1_id: null }).in("player1_id", userIds);
  await serviceClient.from("matches").update({ player2_id: null }).in("player2_id", userIds);

  await serviceClient
    .from("matches")
    .delete()
    .is("player1_id", null)
    .is("player2_id", null)
    .in("phase", ["RR", "ELIM"])
    .in("draw_id", affectedDrawIds.length > 0 ? affectedDrawIds : ["00000000-0000-0000-0000-000000000000"]);

  await serviceClient.from("profiles").delete().in("id", userIds);

  let deletedCount = 0;
  const deletedEmails: string[] = [];
  for (const userId of userIds) {
    const email = authEmailById.get(userId);
    const del = await serviceClient.auth.admin.deleteUser(userId);
    if (!del.error) {
      deletedCount += 1;
      if (email) deletedEmails.push(email);
    }
  }

  return jsonResponse({
    count_deleted: deletedCount,
    deleted_emails: deletedEmails.slice(0, 50),
  });
});
