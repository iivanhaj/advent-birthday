import { createHmac, timingSafeEqual } from "node:crypto";
import { DOOR_COUNT } from "./unlock";

/**
 * Is this request really from GitHub?
 *
 * GitHub signs every delivery: HMAC-SHA256(secret, raw body), sent as
 * `X-Hub-Signature-256: sha256=<hex>`. Only someone who knows the secret can
 * produce a matching signature, so a match proves the sender and that the
 * body wasn't altered.
 *
 * Two details that matter:
 * - Sign the RAW bytes. Parsing and re-serialising JSON can change spacing or
 *   key order, which changes the hash.
 * - Compare in constant time. A normal `===` stops at the first different
 *   character, so response timing leaks how many leading characters were
 *   right, letting an attacker guess a valid signature byte by byte.
 *   `timingSafeEqual` always compares every byte.
 */
export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`);
  const received = Buffer.from(header);
  // timingSafeEqual throws on different lengths; a wrong length is simply a mismatch.
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** The parts of GitHub's push payload we use. */
export type PushPayload = {
  ref?: string;
  deleted?: boolean;
  after?: string;
  repository?: { full_name?: string };
  head_commit?: { id?: string; message?: string } | null;
  commits?: { id?: string; message?: string }[];
};

const DOOR_TAG = /\bdoor:(\d{1,2})\b/gi;

/** Every door number tagged `door:N` across all commits in the push (1–11 only, deduped, sorted). */
export function taggedDoors(payload: PushPayload): number[] {
  const messages = [...(payload.commits ?? []).map((c) => c.message ?? ""), payload.head_commit?.message ?? ""];
  const found = new Set<number>();
  for (const msg of messages) {
    for (const m of msg.matchAll(DOOR_TAG)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= DOOR_COUNT) found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** Branch pushes count; tag pushes and branch deletions don't. */
export function isCountablePush(payload: PushPayload): boolean {
  return !payload.deleted && Boolean(payload.ref?.startsWith("refs/heads/"));
}
