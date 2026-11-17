/**
 * The building, as data. Everything is drawn on a 480 × 720 grid (the SVG
 * viewBox). The HTML windows are positioned with the same numbers converted
 * to percentages, so SVG and HTML line up at any screen size.
 */

export const VIEW_W = 480;
export const VIEW_H = 720;

export type WindowShape = "rect" | "arch" | "round";
export type FloorId = "roof" | "second" | "first" | "ground";

export type BuildingWindow = { n: number; x: number; y: number; w: number; h: number; shape: WindowShape; floor: FloorId };

export const WINDOWS: BuildingWindow[] = [
  { n: 11, x: 175, y: 105, w: 130, h: 145, shape: "arch", floor: "roof" },
  { n: 3, x: 72, y: 140, w: 72, h: 72, shape: "round", floor: "roof" },
  { n: 8, x: 336, y: 140, w: 72, h: 72, shape: "round", floor: "roof" },
  { n: 7, x: 62, y: 288, w: 140, h: 88, shape: "rect", floor: "second" },
  { n: 1, x: 222, y: 276, w: 72, h: 100, shape: "arch", floor: "second" },
  { n: 5, x: 318, y: 288, w: 98, h: 88, shape: "rect", floor: "second" },
  { n: 4, x: 62, y: 410, w: 72, h: 100, shape: "arch", floor: "first" },
  { n: 10, x: 158, y: 418, w: 164, h: 92, shape: "rect", floor: "first" },
  { n: 2, x: 346, y: 410, w: 72, h: 100, shape: "arch", floor: "first" },
  // h 84 so its sill (12 units) ends above the pavement line at y=700
  { n: 6, x: 62, y: 596, w: 130, h: 84, shape: "rect", floor: "ground" },
  { n: 9, x: 212, y: 592, w: 64, h: 108, shape: "arch", floor: "ground" },
];

/**
 * Sill depth in grid units. Every window's sill must end before the next
 * floor line: 250+14 < 268, 376+14 < 396, 510+14 < 528, 680+14 < 700.
 */
export const SILL = 14;
/** Window 9 is the front door: it gets a house-number plate instead of a sill. */
export const FRONT_DOOR = 9;

/** Floors for the phone "elevator": the vertical band of the building each one occupies. */
export const FLOORS: { id: FloorId; label: string; y0: number; y1: number }[] = [
  { id: "roof", label: "R", y0: 20, y1: 275 },
  { id: "second", label: "2", y0: 262, y1: 405 },
  { id: "first", label: "1", y0: 395, y1: 535 },
  { id: "ground", label: "G", y0: 530, y1: 712 },
];

/**
 * The façade, as separate strokes so it can "draw itself" one line at a time.
 * Order matters: outline → roof → floors → awning → shop → details.
 */
export function facadeStrokes(): string[] {
  const s: string[] = [
    "M40 700 V92 H440 V700", // walls
    "M28 72 H452 V92 H28 Z", // cornice
    "M34 84 H446",
    "M190 72 C190 30 290 30 290 72", // pediment
    "M205 72 C205 44 275 44 275 72",
    "M235 56 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0",
    "M370 72 V36 H398 V72", // chimney
    "M366 36 H402",
    "M46 98 C120 118 200 118 240 104 C280 118 360 118 434 98", // bunting string
    "M40 268 H440", // floor lines
    "M40 396 H440",
    "M40 528 H440",
    "M40 540 H440 L450 572 H30 Z", // awning
    "M296 600 H420 V670 H296 Z", // shop window (decorative)
    "M296 636 H420",
    "M358 600 V670",
    // (the pavement and street are drawn by <Ground>, full screen width)
  ];
  // bunting flags
  for (const x of [70, 100, 130, 160, 320, 350, 380, 410]) {
    const y = Math.round((98 + Math.sin(((x - 40) / 394) * Math.PI) * 14) * 10) / 10;
    s.push(`M${x - 6} ${y + 2} L${x} ${y + 12} L${x + 6} ${y + 2}`);
  }
  // awning scallops
  for (let i = 0; i < 14; i++) {
    const x = 30 + i * 30;
    s.push(`M${x} 572 C${x + 5} 584 ${x + 25} 584 ${x + 30} 572`);
  }
  // potted plant + balloon in the shop window
  s.push("M310 630 C306 620 314 612 318 620 C322 612 330 620 326 630 L318 640 Z", "M318 640 V660", "M380 660 L384 640 H396 L400 660", "M390 640 C386 628 380 626 376 620 M390 640 C394 630 400 626 404 620");
  return s;
}

/** Filled stripes on the awning (drawn as a soft tint, not strokes). */
export function awningStripes(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 14; i += 2) out.push(`M${44 + i * 28.6} 540 L${36 + i * 30} 572 L${51 + i * 30} 572 L${56 + i * 28.6} 540 Z`);
  return out;
}

/** The tiny room behind each window, drawn in a 100 × 100 box (floor at the bottom). */
export const ROOMS: Record<number, string> = {
  1: "M30 100 L34 80 H50 L54 100 M42 80 C40 66 30 62 26 56 M42 80 C44 64 54 58 60 52 M42 80 L42 60 M62 100 L64 88 H76 L78 100 M70 88 C68 80 72 74 76 70 M14 100 H86",
  2: "M20 100 C20 90 80 90 80 100 M30 92 C30 76 60 72 66 86 C68 92 60 94 50 94 C42 94 34 94 30 92 M58 78 L60 70 L64 78 M30 92 C22 92 22 84 28 84 M70 62 h7 l-7 7 h7",
  3: "M40 100 L50 40 L60 100 M45 78 L55 78 M30 42 H70 V72 H30 Z M35 64 C42 50 50 66 56 54 C60 48 64 52 66 50",
  4: "M18 100 V58 H82 V100 Z M18 68 C30 63 40 73 50 68 S70 63 82 68 M36 84 C44 76 54 76 60 84 C54 92 44 92 36 84 Z M60 84 L68 78 L68 90 Z M70 60 a2 2 0 1 0 .1 0 M74 52 a2 2 0 1 0 .1 0",
  5: "M42 100 C36 92 38 82 44 78 H56 C62 82 64 92 58 100 Z M50 78 C50 60 46 50 38 42 M50 78 C52 62 58 54 64 46 M50 78 L50 36 M38 42 a4 4 0 1 0 .1 0 M64 46 a4 4 0 1 0 .1 0 M50 36 a5 5 0 1 0 .1 0 M10 100 H90",
  6: "M20 100 V80 C20 70 52 70 52 80 V100 M16 86 H56 M74 100 V58 M65 58 H83 L78 46 H70 Z M60 30 a7 7 0 1 0 8 -3",
  7: "M20 100 V84 H80 V100 Z M28 84 C28 78 62 78 62 84 M72 84 L72 74 L60 80 M38 64 V48 L52 45 V61 M38 64 a3.5 2.5 0 1 1 -.1 0 M52 61 a3.5 2.5 0 1 1 -.1 0",
  8: "M34 36 H66 V80 H34 Z M50 46 L53 55 L62 55 L55 61 L58 70 L50 64 L42 70 L45 61 L38 55 L47 55 Z M18 96 H82 M24 96 V90 H32 V96",
  9: "M28 100 V44 H72 V100 M42 70 H58 M40 50 H60 V62 H40 Z M40 50 L50 57 L60 50 M64 74 a2 2 0 1 0 .1 0",
  10: "M20 90 V50 H80 V90 Z M30 90 L26 100 M70 90 L74 100 M28 80 H44 M54 70 H72 M33 72 h6 v8 h-6z M60 60 L62 64 L66 64 L63 67 L64 71 L60 68 L56 71 L57 67 L54 64 L58 64 Z",
  11: "M12 100 V88 H88 V100 M28 88 V70 H72 V88 M36 70 V58 H64 V70 M44 58 V48 M50 58 V46 M56 58 V48 M44 48 C42 44 44 41 44 39 C44 41 46 44 44 48 M50 46 C48 42 50 39 50 37 C50 39 52 42 50 46 M56 48 C54 44 56 41 56 39 C56 41 58 44 56 48 M8 22 C30 34 70 34 92 22 M20 28 l4 9 5 -7 M44 32 l5 9 5 -9 M68 30 l5 8 4 -9 M28 79 C34 83 40 75 46 79 C52 83 58 75 64 79",
};

/** CSS for an HTML element shaped like a window (arches get a fully rounded top). */
export function windowRadius(w: BuildingWindow): string {
  if (w.shape === "round") return "50%";
  if (w.shape === "arch") return `${(w.w / 2 / w.w) * 100}% ${(w.w / 2 / w.w) * 100}% 0 0 / ${((w.w / 2) / w.h) * 100}% ${((w.w / 2) / w.h) * 100}% 0 0`;
  return "0";
}

/** Percent-based box for positioning HTML over the SVG. */
export function pctBox(x: number, y: number, w: number, h: number) {
  return { left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%`, width: `${(w / VIEW_W) * 100}%`, height: `${(h / VIEW_H) * 100}%` };
}
