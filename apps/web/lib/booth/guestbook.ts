/**
 * Door 6 · the booth's guestbook. What a note may say, and how often.
 *
 * Only words are ever stored: the photos never leave the visitor's browser.
 * A note is checked twice, here (so the API can say exactly what's wrong)
 * and again by the database's own CHECK constraints (so nothing can skip it).
 */

export const NOTE_MAX = 80;
export const NAME_MAX = 24;

export type Note = { id: string | number; message: string; name: string; created_at: string };
export type NoteCheck = { ok: true; message: string; name: string } | { ok: false; reason: string };

// a short, deliberately plain list; the owner can also hide any note by hand
const BLOCKED = ["fuck", "shit", "bitch", "cunt", "nigg", "fag", "slut", "whore", "retard"];

/** Collapse whitespace and drop control and invisible characters. */
export function tidy(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters only, with common look-alikes undone, so "sh1t" and "s.h.i.t" are caught too. */
function squash(s: string): string {
  const swaps: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };
  return s
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => swaps[c] ?? c)
    .replace(/[^a-z]/g, "");
}

export function checkNote(rawMessage: unknown, rawName: unknown): NoteCheck {
  if (typeof rawMessage !== "string" || (rawName !== undefined && rawName !== null && typeof rawName !== "string")) {
    return { ok: false, reason: "That note didn't come through properly." };
  }
  const message = tidy(rawMessage);
  const name = tidy(typeof rawName === "string" ? rawName : "") || "a guest";
  if (message.length < 2) return { ok: false, reason: "Write a few words first." };
  if ([...message].length > NOTE_MAX) return { ok: false, reason: `Keep it under ${NOTE_MAX} characters.` };
  if ([...name].length > NAME_MAX) return { ok: false, reason: `Keep the name under ${NAME_MAX} characters.` };
  const both = `${message} ${name}`;
  if (/(https?:|www\.|\.(com|net|org|io|xyz|ru)\b)/i.test(both)) return { ok: false, reason: "No links in the guestbook, please." };
  // word by word, so "push it" can't read as something else across the gap
  const words = both.split(" ").map(squash);
  if (words.some((word) => BLOCKED.some((b) => word.includes(b)))) return { ok: false, reason: "Let's keep the guestbook kind." };
  return { ok: true, message, name };
}

/** At most this many notes per visitor in a window, and a pause between notes. */
export const RATE = { max: 3, windowMs: 10 * 60_000, gapMs: 20_000 };

/**
 * Sliding-window rate limit: given the times this visitor last signed,
 * may they sign now? Returns how long to wait if not.
 */
export function mayPost(recent: number[], now: number): { ok: true } | { ok: false; retryInMs: number } {
  const inWindow = recent.filter((t) => now - t < RATE.windowMs).sort((a, b) => a - b);
  const last = inWindow[inWindow.length - 1];
  if (last !== undefined && now - last < RATE.gapMs) return { ok: false, retryInMs: RATE.gapMs - (now - last) };
  if (inWindow.length >= RATE.max) return { ok: false, retryInMs: RATE.windowMs - (now - inWindow[0]) };
  return { ok: true };
}

/** Newest first, no duplicates (a realtime insert can arrive after a refetch already had it), capped. */
export function mergeNotes(current: Note[], incoming: Note[], cap = 30): Note[] {
  const seen = new Set<string>();
  return [...incoming, ...current]
    .filter((n) => (seen.has(String(n.id)) ? false : (seen.add(String(n.id)), true)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, cap);
}
