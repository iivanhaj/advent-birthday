/**
 * Door 6 · the photo booth. The strip: where things go, as pure data.
 *
 * A real booth strip is 2 × 6 inches. At 300 dots per inch (print quality)
 * that is exactly 600 × 1800 pixels, so the canvas we draw on *is* the print:
 * no resampling between the screen and the paper.
 */

import type { SkyPhase } from "../sky.ts";

export const DPI = 300;
export const STRIP = { w: 2 * DPI, h: 6 * DPI };
export const POSES = 4;

export type FrameId = "line" | "window" | "garden";
export const FRAMES: { id: FrameId; label: string }[] = [
  { id: "line", label: "Single line" },
  { id: "window", label: "Arched window" },
  { id: "garden", label: "Garden vine" },
];

export type Rect = { x: number; y: number; w: number; h: number };

/** The four photo windows on the strip, 4:3 like the camera, centred, evenly spaced. */
export function photoSlots(): Rect[] {
  const w = 460;
  const h = (w * 3) / 4;
  const top = 80;
  const gap = 50;
  return Array.from({ length: POSES }, (_, i) => ({ x: (STRIP.w - w) / 2, y: top + i * (h + gap), w, h }));
}

/** The four booth looks of the sky, from the real Bangalore sky. */
export type BoothSky = "day" | "golden" | "night" | "rain";
export function boothSky(phase: SkyPhase, raining: boolean): BoothSky {
  if (raining) return "rain";
  if (phase === "dawn" || phase === "dusk") return "golden";
  return phase;
}
export const SKY_WORDS: Record<BoothSky, string> = { day: "clear day", golden: "golden hour", night: "night", rain: "rain" };

/** The typewriter line along the bottom of the strip: place, date, time, sky. */
export function caption(at: Date, sky: BoothSky, tempC: number | null): string {
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const temp = tempC === null ? "" : ` ${tempC}°`;
  return `BANGALORE · ${date.toUpperCase()} · ${time} · ${SKY_WORDS[sky].toUpperCase()}${temp}`;
}

/** File name for a saved strip, e.g. birthday-four-poses-2026-11-23-1940.png */
export function stripFileName(at: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `birthday-four-poses-${g("year")}-${g("month")}-${g("day")}-${g("hour")}${g("minute")}.png`;
}

export type StampId = "heart" | "flower" | "star" | "moon" | "date";
export const STAMP_IDS: StampId[] = ["heart", "flower", "star", "moon", "date"];
export type Stamp = { kind: StampId; x: number; y: number };

/** Roughly how far a stamp reaches from its centre, in strip pixels. */
export const STAMP_RADIUS = 45;

/**
 * Click the strip: lift the stamp under the pointer if there is one (the
 * nearest, if several overlap), otherwise press a new one. Stamps stay inside
 * the paper. Returns a new list.
 */
export function pressOrLift(stamps: Stamp[], kind: StampId, x: number, y: number): Stamp[] {
  let hit = -1;
  let best = STAMP_RADIUS;
  stamps.forEach((s, i) => {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < best) {
      best = d;
      hit = i;
    }
  });
  if (hit >= 0) return stamps.filter((_, i) => i !== hit);
  const r = STAMP_RADIUS;
  return [...stamps, { kind, x: Math.min(STRIP.w - r, Math.max(r, x)), y: Math.min(STRIP.h - r, Math.max(r, y)) }];
}
