import { seeded, type PushRow } from "./pushes";

export type Star = { x: number; y: number; size: number; push: PushRow };
export type Constellation = { door: number; stars: Star[]; label: { x: number; y: number } };

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 16 compass directions as unit vectors, written out instead of computed with
 * Math.cos/sin: trig results can differ in the last digit between Node and
 * browsers, which would make server and client draw different skies.
 */
const DIRS: [number, number][] = [
  [1, 0], [0.924, 0.383], [0.707, 0.707], [0.383, 0.924], [0, 1], [-0.383, 0.924], [-0.707, 0.707], [-0.924, 0.383],
  [-1, 0], [-0.924, -0.383], [-0.707, -0.707], [-0.383, -0.924], [0, -1], [0.383, -0.924], [0.707, -0.707], [0.924, -0.383],
];

/**
 * Lay one day's pushes out as a constellation inside an ellipse around `anchor`.
 *
 * Like a sky chart, each star steps away from the previous one, and every star
 * keeps a minimum distance from all the others. For each new star we try the
 * 16 directions (starting from one seeded by the commit SHA) and take the first
 * spot that's inside the ellipse and clear of every other star; if none is,
 * the roomiest spot wins. Seeded by SHA, so the same pushes always draw the
 * same constellation, on every screen.
 */
export function constellation(door: number, pushes: PushRow[], anchor: [number, number], radius: number): Constellation {
  const rx = radius;
  const ry = radius * 0.72;
  // busy days pack a little tighter so they still fit
  const minGap = radius * 0.46 * Math.sqrt(6 / Math.max(6, pushes.length));
  const stars: Star[] = [];
  const inside = (x: number, y: number) => ((x - anchor[0]) / rx) ** 2 + ((y - anchor[1]) / ry) ** 2 <= 1;
  const clearance = (x: number, y: number) => stars.reduce((m, s) => Math.min(m, Math.hypot(s.x - x, s.y - y)), Infinity);

  pushes.forEach((p, i) => {
    const r = seeded(p.sha ?? p.delivery_id);
    const size = r1(2.8 + r() * 2.2);
    if (i === 0) {
      // first star: a little off-centre so constellations don't all start on their anchor
      stars.push({ x: r1(anchor[0] + (r() - 0.5) * rx * 0.5), y: r1(anchor[1] + (r() - 0.5) * ry * 0.5), size, push: p });
      return;
    }
    const from = stars[stars.length - 1];
    const step = radius * (0.5 + r() * 0.3);
    const start = Math.floor(r() * 16);
    let best: [number, number] | null = null;
    let bestGap = -1;
    for (let k = 0; k < 16; k++) {
      const [dx, dy] = DIRS[(start + k * 5) % 16]; // hop around the compass, not just clockwise
      const x = from.x + dx * step;
      const y = from.y + dy * step * 0.8;
      if (!inside(x, y)) continue;
      const gap = clearance(x, y);
      if (gap >= minGap) {
        best = [x, y];
        break;
      }
      if (gap > bestGap) {
        bestGap = gap;
        best = [x, y];
      }
    }
    // nothing inside the ellipse at all: fall back towards the anchor
    const [x, y] = best ?? [(from.x + anchor[0]) / 2, (from.y + anchor[1]) / 2];
    stars.push({ x: r1(x), y: r1(y), size, push: p });
  });

  return { door, stars, label: { x: anchor[0], y: r1(anchor[1] + ry + 28) } };
}

/** A 4-point sparkle star centred on (0,0). */
export function starPath(s: number): string {
  const k = r1(s * 0.28);
  return `M0 ${-s * 2} Q${k} ${-k} ${s * 2} 0 Q${k} ${k} 0 ${s * 2} Q${-k} ${k} ${-s * 2} 0 Q${-k} ${-k} 0 ${-s * 2}Z`;
}

/**
 * Where each door's constellation sits on the building's homepage, in
 * building units (480 × 720). Desktop: two columns of sky either side of the
 * building (`side` = free space on each side). Phone: the sky above the roof.
 */
export function anchors(isPhone: boolean, side: number): [number, number][] {
  if (isPhone) {
    const xs = [60, 180, 300, 420];
    const ys = [-182, -108, -36];
    return Array.from({ length: 12 }, (_, i) => [xs[i % 4], ys[Math.floor(i / 4)]] as [number, number]);
  }
  const L = (f: number) => r1(-side * f);
  const R = (f: number) => r1(480 + side * f);
  // door 0, 1, 2… alternate left and right, top to bottom, staggered in and out
  return [
    [L(0.6), 200], [R(0.42), 130], [L(0.3), 300], [R(0.74), 230], [L(0.68), 400], [R(0.36), 330],
    [L(0.32), 500], [R(0.72), 430], [L(0.64), 600], [R(0.38), 530], [L(0.3), 690], [R(0.7), 630],
  ];
}
