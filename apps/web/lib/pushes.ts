import { DOOR_COUNT, START_DATE, doorDate } from "./unlock";

/** A row from the `pushes` table (the columns the site shows). */
export type PushRow = {
  delivery_id: string;
  sha: string | null;
  message: string | null;
  repo: string | null;
  pushed_at: string;
  ist_date: string; // YYYY-MM-DD, decided by the server when the push landed
};

/**
 * Which door a push belongs to: the door whose day it landed on (IST).
 * Nov 17 is door 0 (the foundation, planted in the shop window). Pushes
 * outside the countdown don't belong to any door.
 */
export function doorOfPush(p: Pick<PushRow, "ist_date">): number | null {
  if (p.ist_date === START_DATE) return 0;
  for (let n = 1; n <= DOOR_COUNT; n++) if (doorDate(n) === p.ist_date) return n;
  return null;
}

/** Pushes grouped by door, oldest first within each door. */
export function pushesByDoor(pushes: PushRow[]): Map<number, PushRow[]> {
  const out = new Map<number, PushRow[]>();
  for (const p of [...pushes].sort((a, b) => a.pushed_at.localeCompare(b.pushed_at))) {
    const n = doorOfPush(p);
    if (n == null) continue;
    if (!out.has(n)) out.set(n, []);
    out.get(n)!.push(p);
  }
  return out;
}

/** Short commit label for cards: first line of the message, trimmed. */
export function commitTitle(p: Pick<PushRow, "message">): string {
  return (p.message ?? "(no message)").split("\n")[0].slice(0, 80);
}

/**
 * Deterministic pseudo-random numbers from a string (a commit SHA). Integer-only
 * maths (Math.imul), so Node and every browser produce exactly the same values:
 * the same push always gets the same flower spot and the same star position.
 */
export function seeded(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Dev-only sample data for ?preview=…, so the sky and boxes can be designed before real pushes exist. */
export function samplePushes(upToDoor: number): PushRow[] {
  const msgs = [
    "feat: scaffold the door",
    "feat: first working version",
    "fix: spacing on phones",
    "style: polish the details",
    "docs: what I learned",
    "solve: blind 75 warm-up",
  ];
  const rows: PushRow[] = [];
  for (let n = 0; n <= upToDoor; n++) {
    const date = doorDate(n);
    const r = seeded(`sample-${n}`);
    const count = 2 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      const sha = Math.floor(r() * 0xfffffff).toString(16).padStart(7, "0");
      rows.push({
        delivery_id: `sample-${n}-${i}`,
        sha,
        message: msgs[(n + i) % msgs.length],
        repo: i === count - 1 && n > 0 ? "blind-75" : "advent-birthday",
        pushed_at: `${date}T${String(9 + i * 2).padStart(2, "0")}:15:00+05:30`,
        ist_date: date,
      });
    }
  }
  return rows;
}
