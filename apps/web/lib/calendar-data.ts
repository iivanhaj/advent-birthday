import { DOOR_COUNT, devUnlockAll, doorDate, isDoorReachable } from "./unlock";
import { DOOR_META, type CalendarDoor, type DoorRow } from "./doors";
import { publicClient } from "./supabase/server";

/** Doors as they'd look with nothing pushed yet: used before Supabase is set up. */
function emptyDoors(): DoorRow[] {
  return Array.from({ length: DOOR_COUNT }, (_, i) => ({
    n: i + 1,
    date: doorDate(i + 1),
    title: DOOR_META[i + 1].title,
    sprouted_at: null,
    shipped_at: null,
  }));
}

/**
 * Dev-only design preview (?preview=mixed): fake a few pushed/shipped doors so
 * every state can be seen before any real pushes exist. Ignored unless
 * DEV_UNLOCK_ALL is on, so it can never show up in production.
 */
function previewRows(rows: DoorRow[], preview: string | undefined): DoorRow[] {
  if (!devUnlockAll() || !preview) return rows;
  const stamp = new Date().toISOString();
  return rows.map((r) => {
    if (preview === "finale") return { ...r, sprouted_at: stamp, shipped_at: stamp };
    if (preview === "mixed" && r.n <= 5) return { ...r, sprouted_at: stamp, shipped_at: stamp };
    if (preview === "mixed" && r.n <= 7) return { ...r, sprouted_at: stamp };
    return r;
  });
}

export async function getCalendarDoors(preview?: string): Promise<CalendarDoor[]> {
  let rows = emptyDoors();
  const supabase = publicClient();
  if (supabase) {
    const { data, error } = await supabase.from("doors").select("n, date, title, sprouted_at, shipped_at").order("n");
    if (error) console.error("Couldn't load doors, showing empty calendar:", error.message);
    else if (data?.length) rows = data as DoorRow[];
  }
  const now = new Date();
  return previewRows(rows, preview).map((r) => ({ ...r, reachable: isDoorReachable(r.n, now) }));
}
