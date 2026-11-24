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

/** A five-petal flower as outline circles, for the room drawings. */
function flower(x: number, y: number, r: number): string {
  let d = "";
  for (let i = 0; i < 5; i++) {
    const a = i * 1.2566 - Math.PI / 2;
    const cx = Math.round((x + Math.cos(a) * r) * 10) / 10;
    const cy = Math.round((y + Math.sin(a) * r) * 10) / 10;
    const pr = Math.round(r * 6.2) / 10;
    d += ` M${cx + pr} ${cy} a${pr} ${pr} 0 1 0 .1 0`;
  }
  return d + ` M${x + r * 0.35} ${y} a${r * 0.35} ${r * 0.35} 0 1 0 .1 0`;
}

/**
 * The tiny room behind each window, drawn in a 100 × 100 box (floor at the
 * bottom): one object for that day's build, standing on the floor or a piece
 * of furniture. The building itself only shows the front door's; the rest
 * appear on the door pages still to come.
 */
export const ROOMS: Record<number, string> = {
  // a bell jar over a fern, on a side table (the living garden)
  1: "M26 100 V84 M74 100 V84 M20 84 H80 M36 84 H64 V80 H36 Z M38 80 V58 C38 40 62 40 62 58 V80 M47 44 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M50 80 C50 70 50 64 50 56 M50 72 C44 68 41 63 42 58 C46 60 49 65 50 72 M50 66 C56 62 59 57 58 52 C54 55 51 60 50 66 M41 62 C44 61 46 63 47 65",
  // Mochi asleep in her basket
  2: "M20 100 C20 84 80 84 80 100 M24 92 H76 M22 97 H78 M30 88 C27 73 42 64 57 68 C67 70 72 78 70 88 M57 68 L60 60 L64 69 M64 69 L68 62 L70 72 M30 88 C40 93 58 93 68 88 M59 77 q3 2 6 0 M76 60 h5 l-5 5 h5 M83 50 h4 l-4 4 h4",
  // a record player on a cabinet, notes rising
  3: "M20 100 V80 H80 V100 M20 90 H80 M50 80 V100 M44 85 h-4 M60 85 h-4 M24 80 V72 H76 V80 M30 72 a17 3.4 0 1 0 34 0 a17 3.4 0 1 0 -34 0 M44 72 a3 .8 0 1 0 6 0 a3 .8 0 1 0 -6 0 M72 64 V72 M72 64 L60 69 M36 54 V40 L48 36 V50 M36 54 a3.5 2.4 0 1 1 -.1 0 M48 50 a3.5 2.4 0 1 1 -.1 0",
  // a fishbowl with a koi (the commit pond)
  4: "M34 100 L40 87 H60 L66 100 M37 93 H63 M40 87 C26 78 27 55 41 50 H59 C73 55 74 78 60 87 Z M32 63 C42 66 58 61 68 63 M45 74 C49 70 57 70 59 74 C57 78 49 78 45 74 Z M45 74 L40 71 L40 77 Z M56 73 a.8 .8 0 1 0 .1 0 M62 56 a1.6 1.6 0 1 0 .1 0 M58 50 a1.2 1.2 0 1 0 .1 0",
  // a vase of flowers (the infinite bloom)
  5: "M40 100 C33 92 36 80 43 76 H57 C64 80 67 92 60 100 Z M42 82 H58 M50 76 C50 62 46 52 38 44 M50 76 C52 62 58 54 66 48 M50 76 V38 M50 64 C46 62 44 58 44 56 M50 60 C55 58 58 55 58 53" + flower(38, 42, 4.5) + flower(66, 46, 4.5) + flower(50, 33, 5.5),
  // a camera on a tripod (the photo booth)
  6: "M50 72 L36 100 M50 72 L64 100 M50 72 V100 M42 88 H58 M32 54 H68 V72 H32 Z M36 54 V50 H44 V54 M56 62 a7 7 0 1 0 -12 0 a7 7 0 1 0 12 0 M53 62 a3 3 0 1 0 -6 0 a3 3 0 1 0 6 0 M62 58 h3",
  // a little carousel music box (firefly music)
  7: "M26 100 V94 H74 V100 M24 94 C24 90 76 90 76 94 M32 92 V64 M42 92 V64 M58 92 V64 M68 92 V64 M50 92 V62 M26 64 H74 M26 64 C30 70 34 70 38 64 C42 70 46 70 50 64 C54 70 58 70 62 64 C66 70 70 70 74 64 M26 64 L50 46 L74 64 M50 46 V38 M50 38 L58 40 L50 43 M30 80 h4 v4 h-4z M64 78 h4 v4 h-4z",
  // a card on an easel, catching the light (the holographic card)
  8: "M38 100 L46 48 M62 100 L54 48 M50 44 V100 M34 52 H66 V80 H34 Z M40 58 L60 74 M60 58 L40 74 M74 40 v8 M70 44 h8 M26 46 v6 M23 49 h6",
  // the front door: panels, a letter slot, a knob
  9: "M28 100 V44 H72 V100 M42 70 H58 M40 50 H60 V62 H40 Z M40 50 L50 57 L60 50 M64 74 a2 2 0 1 0 .1 0",
  // an arcade cabinet (the game)
  10: "M34 100 V44 L40 36 H62 L66 44 V100 M34 66 H66 M38 46 H62 V62 H38 Z M44 76 V70 M44 70 a3 3 0 1 0 .1 0 M56 74 a2 2 0 1 0 .1 0 M62 74 a2 2 0 1 0 .1 0 M40 86 H60",
  // a birthday cake with three candles (blow out the candles)
  11: "M16 100 H84 M24 100 V82 H76 V100 M32 82 V68 H68 V82 M24 86 C28 90 32 90 36 86 C40 90 44 90 48 86 C52 90 56 90 60 86 C64 90 68 90 72 86 M32 72 C36 75 40 75 44 72 C48 75 52 75 56 72 C60 75 64 75 68 72 M40 68 V58 M50 68 V56 M60 68 V58 M40 58 C38 54 40 52 40 50 C40 52 42 54 40 58 M50 56 C48 52 50 50 50 48 C50 50 52 52 50 56 M60 58 C58 54 60 52 60 50 C60 52 62 54 60 58",
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
