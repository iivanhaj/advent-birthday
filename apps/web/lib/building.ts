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

/** A window's outline, grown by `o` units on every side (for the moulded frame round it). */
export function windowOutline(w: BuildingWindow, o = 0): string {
  const x = w.x - o, y = w.y - o, ww = w.w + 2 * o, h = w.h + 2 * o;
  if (w.shape === "round") return `M${x + ww / 2} ${y} a${ww / 2} ${h / 2} 0 1 0 .1 0 Z`;
  if (w.shape === "arch") {
    const r = ww / 2;
    return `M${x} ${y + h} V${y + r} A${r} ${r} 0 0 1 ${x + ww} ${y + r} V${y + h}`;
  }
  return `M${x} ${y} H${x + ww} V${y + h} H${x} Z`;
}

/**
 * The finer details that make the façade read as a building rather than an
 * outline: drawn after the main strokes, in the same pen.
 *  - `trim`: moulded frames round every window, keystones on the arches,
 *    little brackets under the sills, dentils under the cornice, a second line
 *    on each string course, a star on the pediment, a cap on the chimney.
 *  - `texture`: very faint stucco courses and corner stones (quoins).
 */
export function facadeDetails(): { trim: string[]; texture: string[] } {
  const trim: string[] = [];
  for (const w of WINDOWS) {
    trim.push(windowOutline(w, 5));
    if (w.shape === "arch") trim.push(`M${w.x + w.w / 2 - 6} ${w.y - 7} h12 l-2 10 h-8 Z`);
    if (w.n !== FRONT_DOOR) {
      const y = w.y + w.h + SILL;
      trim.push(`M${w.x + 1} ${y} q0 3.5 4 3.5 M${w.x + w.w - 1} ${y} q0 3.5 -4 3.5`);
    }
  }
  for (let x = 44; x < 438; x += 12) trim.push(`M${x} 92 v5 h6 v-5`);
  for (const y of [268, 396, 528]) trim.push(`M40 ${y - 5} H440`);
  trim.push("M240 49 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1 Z", "M364 36 H404 V30 H364 Z");
  // the front door's step, and a potted bay tree either side of it
  trim.push("M200 700 v-4 h88 v4");
  for (const x of [196, 284]) {
    trim.push(`M${x - 9} 696 L${x - 11} 682 H${x + 11} L${x + 9} 696`, `M${x} 682 C${x - 2} 666 ${x} 658 ${x} 652 M${x} 672 c-5 -2 -8 -6 -8 -10 M${x} 666 c5 -2 7 -6 7 -9 M${x} 658 c-4 -1 -6 -4 -6 -7`);
  }
  const texture: string[] = [];
  for (let y = 114; y < 700; y += 22) texture.push(`M44 ${y} H436`);
  for (let y = 100, i = 0; y < 690; y += 26, i++) {
    const a = i % 2 ? 14 : 20;
    texture.push(`M40 ${y} h${a} v24 h-${a} M440 ${y} h-${a} v24 h${a}`);
  }
  return { trim, texture };
}

/** The bunting flags as closed shapes, so they can carry a wash of colour. */
export function buntingFlags(): string[] {
  return [70, 100, 130, 160, 320, 350, 380, 410].map((x) => {
    const y = Math.round((98 + Math.sin(((x - 40) / 394) * Math.PI) * 14) * 10) / 10;
    return `M${x - 6} ${y + 2} L${x} ${y + 12} L${x + 6} ${y + 2} Z`;
  });
}

/** Filled stripes on the awning (drawn as a soft tint, not strokes). */
export function awningStripes(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 14; i += 2) out.push(`M${44 + i * 28.6} 540 L${36 + i * 30} 572 L${51 + i * 30} 572 L${56 + i * 28.6} 540 Z`);
  return out;
}

/**
 * The front door, drawn in a 100 × 100 box (floor at the bottom): panels, a
 * letter slot and a knob. Every other window shows only its pendant lamp.
 */
export const ROOMS: Record<number, string> = {
  9: "M28 100 V44 H72 V100 M42 70 H58 M40 50 H60 V62 H40 Z M40 50 L50 57 L60 50 M64 74 a2 2 0 1 0 .1 0",
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
