/**
 * Unlock rules. Server-only in spirit: the client never decides what's open,
 * it just renders what the server computed. (Otherwise anyone could change
 * their laptop clock and peek at Door 11.)
 *
 * Why Asia/Kolkata everywhere: "today" depends on where you are. Vercel's
 * servers run in UTC, so at 2am IST on Nov 21 the server thinks it's still
 * Nov 20. Formatting the instant in a fixed timezone removes that ambiguity.
 */

export const TIMEZONE = "Asia/Kolkata";
/** Door 0 (the scaffold). Door n's date is START_DATE + n days. */
export const START_DATE = "2026-11-17";
export const DOOR_COUNT = 11;

const istFormatter = new Intl.DateTimeFormat("en-CA", {
  // en-CA formats as YYYY-MM-DD, which also sorts correctly as a string.
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in India for a given instant, as "YYYY-MM-DD". */
export function istDate(at: Date = new Date()): string {
  return istFormatter.format(at);
}

/** Door n's date, as "YYYY-MM-DD". Pure date math in UTC so DST/timezones can't shift it. */
export function doorDate(n: number): string {
  const d = new Date(`${START_DATE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Which door belongs to a date (1–11), or null outside the countdown. */
export function doorForDate(date: string): number | null {
  for (let n = 1; n <= DOOR_COUNT; n++) if (doorDate(n) === date) return n;
  return null;
}

/**
 * DEV_UNLOCK_ALL=true opens every door so you can build future ones locally.
 * It's ignored on Vercel production even if someone sets it by accident.
 */
export function devUnlockAll(): boolean {
  return process.env.DEV_UNLOCK_ALL === "true" && process.env.VERCEL_ENV !== "production";
}

/** Can door n be opened right now? Plain string comparison works because of YYYY-MM-DD. */
export function isDoorReachable(n: number, at: Date = new Date()): boolean {
  if (!Number.isInteger(n) || n < 1 || n > DOOR_COUNT) return false;
  return devUnlockAll() || istDate(at) >= doorDate(n);
}

/** "Sat, Nov 21" for a YYYY-MM-DD string. */
export function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days from today (IST) until the birthday. */
export function sleepsUntilBirthday(at: Date = new Date()): number {
  const ms = Date.parse(`${doorDate(DOOR_COUNT)}T00:00:00Z`) - Date.parse(`${istDate(at)}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}
