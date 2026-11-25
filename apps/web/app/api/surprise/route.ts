import { isOpen, unseal, type Sealed } from "@/lib/surprise/open";
import sealed from "@/lib/surprise/sealed.json";

export const dynamic = "force-dynamic";

/** Hands out what's kept for the 28th, decrypted, but only once the day has come. */
export async function GET() {
  // local development can peek with DEV_UNLOCK_ALL; any deployed build waits for the day
  const early = process.env.NODE_ENV === "development" && process.env.DEV_UNLOCK_ALL === "true";
  if (!isOpen() && !early) return Response.json({ error: "Not yet." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const key = process.env.SURPRISE_KEY;
  if (!key) return Response.json({ error: "The key isn't set up yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    return new Response(unseal(sealed as Sealed, key), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The key doesn't fit." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
