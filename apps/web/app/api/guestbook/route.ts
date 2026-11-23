import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { checkNote, mayPost, RATE, type Note } from "@/lib/booth/guestbook";
import { adminClient, publicClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(body, { status, headers });
const COLUMNS = "id, message, name, created_at";

/** The latest notes, read with the public key (RLS hides any note the owner has hidden). */
export async function GET() {
  const sb = publicClient();
  if (!sb) return json({ notes: [] });
  const { data, error } = await sb.from("guest_notes").select(COLUMNS).order("created_at", { ascending: false }).limit(30);
  if (error) return json({ notes: [] });
  return json({ notes: data as Note[] });
}

/**
 * Sign the guestbook.
 *
 * 1. Check the note (length, no links, kind words): the same rules the page
 *    runs, and the table's CHECK constraints run a third time.
 * 2. Rate-limit by visitor. The visitor is a keyed hash of their IP address
 *    (HMAC with a server secret): enough to tell visitors apart, but the
 *    address itself is never stored and the hash can't be reversed into one.
 * 3. Insert with the service key; Realtime then sends the note to every open booth.
 */
export async function POST(req: Request) {
  let body: { message?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "That note didn't come through properly." }, 400);
  }
  const check = checkNote(body.message, body.name);
  if (!check.ok) return json({ error: check.reason }, 400);

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let sb;
  try {
    sb = adminClient();
  } catch {
    return json({ error: "The guestbook isn't open yet." }, 503);
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const visitor = createHmac("sha256", secret!).update(`guestbook:${ip}`).digest("hex").slice(0, 32);

  const since = new Date(Date.now() - RATE.windowMs).toISOString();
  const { data: recent, error: readErr } = await sb.from("guest_rate").select("at").eq("visitor", visitor).gte("at", since);
  if (readErr) {
    console.error("guestbook rate read failed:", readErr.message);
    return json({ error: "The guestbook couldn't take that just now." }, 500);
  }
  const verdict = mayPost((recent ?? []).map((r) => Date.parse(r.at as string)), Date.now());
  if (!verdict.ok) {
    const s = Math.ceil(verdict.retryInMs / 1000);
    return json({ error: `That's a lot of signing. Try again in ${s < 60 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`}.` }, 429, { "retry-after": String(s) });
  }

  const { error: rateErr } = await sb.from("guest_rate").insert({ visitor });
  if (rateErr) console.error("guestbook rate write failed:", rateErr.message);
  const { data, error } = await sb.from("guest_notes").insert({ message: check.message, name: check.name }).select(COLUMNS).single();
  if (error) {
    console.error("guestbook insert failed:", error.message);
    return json({ error: "The guestbook couldn't take that just now." }, 500);
  }
  return json({ note: data as Note }, 201);
}
