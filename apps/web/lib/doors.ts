
/** Shared door shapes. Safe to import from client components (no env, no secrets). */

/** A row from the `doors` table. */
export type DoorRow = {
  n: number;
  date: string; // YYYY-MM-DD
  title: string;
  sprouted_at: string | null;
  shipped_at: string | null;
};

/** What the server hands the calendar: the row plus the server's unlock decision. */
export type CalendarDoor = DoorRow & { reachable: boolean };

/**
 * locked   → future date: shutters stay shut
 * awake    → reachable, no push that day yet: shutters closed, lamp off
 * sprouted → a push landed that day: shutters open, lamp on at night
 * shipped  → a commit said door:N: open, lamp glows after sunset
 * golden   → the finale has shipped: every lamp on, fireworks
 */
export type DoorState = "locked" | "awake" | "sprouted" | "shipped" | "golden";

export function doorState(door: CalendarDoor, finaleShipped: boolean): DoorState {
  if (!door.reachable) return "locked";
  if (door.shipped_at) return finaleShipped ? "golden" : "shipped";
  if (door.sprouted_at) return "sprouted";
  return "awake";
}

/** Per-door content that isn't in the DB. (Where each window sits lives in lib/building.ts.) */
export const DOOR_META: Record<number, { title: string }> = {
  1: { title: "The living garden" },
  2: { title: "Mochi, the coding pet" },
  3: { title: "Birthday-seeded art" },
  4: { title: "GPU koi pond" },
  5: { title: "Recursive flowers" },
  6: { title: "Cozy room, real sky" },
  7: { title: "Firefly music" },
  8: { title: "Holographic card" },
  9: { title: "Time-locked letter" },
  10: { title: "Jae: The Game" },
  11: { title: "Blow out the candles" },
};
