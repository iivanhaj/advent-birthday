import { seeded, type PushRow } from "./pushes";

export type Star = { x: number; y: number; size: number; push: PushRow };
export type Constellation = { door: number; stars: Star[]; label: { x: number; y: number } };

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Lay one day's pushes out as a constellation around an anchor point.
 * The first push sits on the anchor; each later push is placed relative to the
 * previous star, using a generator seeded by its commit SHA. So the same
 * pushes always draw the same constellation, on every screen, forever.
 * (No trig, only integer-seeded maths: identical on server and browser.)
 */
export function constellation(door: number, pushes: PushRow[], anchor: [number, number], radius: number): Constellation {
  const stars: Star[] = [];
  let [x, y] = anchor;
  pushes.forEach((p, i) => {
    const r = seeded(p.sha ?? p.delivery_id);
    if (i > 0) {
      // step away from the previous star, but stay within `radius` of the anchor
      x += (r() - 0.5) * radius * 1.3;
      y += (r() - 0.5) * radius * 0.9;
      x = Math.min(anchor[0] + radius, Math.max(anchor[0] - radius, x));
      y = Math.min(anchor[1] + radius * 0.7, Math.max(anchor[1] - radius * 0.7, y));
    } else {
      r();
      r();
    }
    stars.push({ x: r1(x), y: r1(y), size: r1(2.6 + r() * 2), push: p });
  });
  return { door, stars, label: { x: anchor[0], y: r1(anchor[1] + radius * 0.7 + 16) } };
}

/** A 4-point sparkle star centred on (0,0). */
export function starPath(s: number): string {
  const k = r1(s * 0.28);
  return `M0 ${-s * 2} Q${k} ${-k} ${s * 2} 0 Q${k} ${k} 0 ${s * 2} Q${-k} ${k} ${-s * 2} 0 Q${-k} ${-k} 0 ${-s * 2}Z`;
}

/**
 * Where each door's constellation sits, in building units (480 × 720).
 * Desktop: two columns of sky either side of the building, as wide as the
 * screen allows (`side` = free space on each side, in building units).
 * Phone: the strip of sky above the roof.
 */
export function anchors(isPhone: boolean, side: number): [number, number][] {
  if (isPhone) {
    const xs = [55, 175, 305, 425];
    // three rows spread across the sky between the title and the roof
    const ys = [-178, -108, -38];
    return Array.from({ length: 12 }, (_, i) => [xs[i % 4], ys[Math.floor(i / 4)]] as [number, number]);
  }
  const L = (f: number) => r1(-side * f);
  const R = (f: number) => r1(480 + side * f);
  // door 0, 1, 2… alternate left and right, top to bottom
  return [
    [L(0.62), 190], [R(0.4), 110], [L(0.3), 270], [R(0.72), 200], [L(0.68), 370], [R(0.34), 300],
    [L(0.32), 460], [R(0.7), 400], [L(0.66), 560], [R(0.36), 500], [L(0.3), 640], [R(0.68), 600],
  ];
}
