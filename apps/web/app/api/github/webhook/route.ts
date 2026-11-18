import { NextResponse } from "next/server";
import { isCountablePush, pushFileKinds, taggedDoors, verifySignature, type PushPayload } from "@/lib/github-webhook";
import { adminClient } from "@/lib/supabase/server";
import { istDate } from "@/lib/unlock";

// node:crypto needs the Node runtime (not Edge), and webhooks must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * GitHub push → light a window.
 *
 * 1. Verify X-Hub-Signature-256 (reject anything unsigned or wrong).
 * 2. Ignore everything that isn't a branch push (ping is answered politely).
 * 3. Hand the push to record_push(), which dedupes on X-GitHub-Delivery and
 *    sprouts/ships doors in one transaction.
 * 4. Supabase Realtime then broadcasts the door change to every open browser.
 */
export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return json({ error: "webhook not configured" }, 500);

  // Read the raw body ONCE, as text: the signature is over these exact bytes.
  const rawBody = await req.text();
  if (!verifySignature(secret, rawBody, req.headers.get("x-hub-signature-256"))) {
    return json({ error: "bad signature" }, 401);
  }

  const event = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery");
  if (event === "ping") return json({ ok: true, pong: true });
  if (event !== "push") return json({ ignored: `event ${event}` }, 202);
  if (!deliveryId) return json({ error: "missing X-GitHub-Delivery" }, 400);

  let payload: PushPayload;
  try {
    payload = JSON.parse(rawBody) as PushPayload;
  } catch {
    return json({ error: "body is not JSON" }, 400);
  }
  if (!isCountablePush(payload)) return json({ ignored: "not a branch push" }, 202);

  // "Today" is decided here, on the server, in IST, at the moment the push lands.
  const now = new Date();
  const head = payload.head_commit;
  let supabase;
  try {
    supabase = adminClient();
  } catch {
    return json({ error: "database not configured" }, 500);
  }
  const args = {
    p_delivery_id: deliveryId,
    p_repo: payload.repository?.full_name ?? null,
    p_sha: head?.id ?? payload.after ?? null,
    p_message: head?.message?.slice(0, 500) ?? null,
    p_pushed_at: now.toISOString(),
    p_ist_date: istDate(now),
    p_ship_doors: taggedDoors(payload),
  };
  let { data, error } = await supabase.rpc("record_push", { ...args, p_files: pushFileKinds(payload) });
  // PGRST202 = "no function with these arguments": the database hasn't had the
  // file-kinds migration yet. Record the push the old way rather than lose it.
  if (error?.code === "PGRST202") ({ data, error } = await supabase.rpc("record_push", args));

  if (error) {
    // 500 makes GitHub show the delivery as failed so you can hit "Redeliver";
    // the delivery-id dedupe makes that retry safe.
    console.error("record_push failed:", error.message);
    return json({ error: "database error" }, 500);
  }
  return json({ ok: true, ...data });
}
