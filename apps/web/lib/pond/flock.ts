/**
 * Door 4 · the commit pond. The flocking maths, pure and unit-tested.
 *
 * Boids (Craig Reynolds, 1987): every koi steers by three local rules:
 *   separation: don't crowd anyone (all koi);
 *   alignment:  swim the way your school swims;
 *   cohesion:   drift toward your school's centre.
 * Here a "school" is one day's pushes, so each day's koi swim together.
 *
 * Checking every koi against every other is O(n²). A spatial hash makes it
 * roughly O(n): the pond is cut into cells the size of a koi's sight range,
 * every koi is filed under its cell, and a koi only looks at the 3 × 3 block
 * of cells around it. Same neighbours, a tiny fraction of the checks.
 */

export type Fish = { x: number; y: number; vx: number; vy: number; school: number };

export type FlockParams = {
  sight: number; // how far a koi can see its school
  personal: number; // closer than this to anyone and it pulls away
  minSpeed: number;
  maxSpeed: number;
  separation: number;
  alignment: number;
  cohesion: number;
  wall: number; // how hard the pond's edge pushes back
  margin: number;
};

export const DEFAULT_FLOCK: FlockParams = {
  sight: 70,
  personal: 22,
  minSpeed: 30,
  maxSpeed: 95,
  separation: 5,
  alignment: 0.9,
  cohesion: 0.45,
  wall: 4,
  margin: 50,
};

/** Extra steering for one step: a point to swim toward, and ripples to flee. */
export type Influences = {
  target?: { x: number; y: number; pull: number; range: number } | null;
  ripples?: { x: number; y: number; radius: number; strength: number }[];
};

// ---------- spatial hash ----------

export class SpatialHash {
  private cells = new Map<number, number[]>();
  private readonly size: number;
  private readonly cols: number;
  constructor(size: number, cols: number) {
    this.size = size;
    this.cols = cols;
  }

  private key(cx: number, cy: number) {
    return cy * (this.cols + 2) + cx;
  }

  build(points: { x: number; y: number }[]) {
    this.cells.clear();
    for (let i = 0; i < points.length; i++) {
      const k = this.key(Math.floor(points[i].x / this.size), Math.floor(points[i].y / this.size));
      const list = this.cells.get(k);
      if (list) list.push(i);
      else this.cells.set(k, [i]);
    }
  }

  /** Calls `visit(j)` for every point in the 3 × 3 cells around (x, y): a superset of everything within `size`. */
  near(x: number, y: number, visit: (j: number) => void) {
    const cx = Math.floor(x / this.size);
    const cy = Math.floor(y / this.size);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.cells.get(this.key(cx + dx, cy + dy));
        if (list) for (const j of list) visit(j);
      }
  }
}

/** Indices of every fish within `r` of fish i, by brute force (the reference the hash is tested against). */
export function neighboursBrute(fish: Fish[], i: number, r: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < fish.length; j++) if (j !== i && (fish[j].x - fish[i].x) ** 2 + (fish[j].y - fish[i].y) ** 2 <= r * r) out.push(j);
  return out;
}

/** The same, through the hash. */
export function neighboursHashed(fish: Fish[], i: number, r: number, hash: SpatialHash): number[] {
  const out: number[] = [];
  hash.near(fish[i].x, fish[i].y, (j) => {
    if (j !== i && (fish[j].x - fish[i].x) ** 2 + (fish[j].y - fish[i].y) ** 2 <= r * r) out.push(j);
  });
  return out.sort((a, b) => a - b);
}

// ---------- one step ----------

/**
 * Advance every koi by `dt` seconds, in place. Returns how many neighbour
 * pairs were examined (the number the page shows to compare hash vs brute force).
 */
export function stepFlock(fish: Fish[], width: number, height: number, dt: number, p: FlockParams = DEFAULT_FLOCK, inf: Influences = {}, useHash = true): number {
  const hash = new SpatialHash(p.sight, Math.ceil(width / p.sight));
  if (useHash) hash.build(fish);
  let checks = 0;
  const ax = new Float64Array(fish.length);
  const ay = new Float64Array(fish.length);

  for (let i = 0; i < fish.length; i++) {
    const f = fish[i];
    let cx = 0, cy = 0, vx = 0, vy = 0, sx = 0, sy = 0, n = 0;
    const visit = (j: number) => {
      if (j === i) return;
      checks++;
      const o = fish[j];
      const dx = o.x - f.x;
      const dy = o.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < p.personal * p.personal) {
        const d = Math.sqrt(d2) + 1e-6;
        sx -= (dx / d) * (p.personal - d);
        sy -= (dy / d) * (p.personal - d);
      }
      if (o.school !== f.school || d2 > p.sight * p.sight) return;
      n++;
      cx += o.x;
      cy += o.y;
      vx += o.vx;
      vy += o.vy;
    };
    if (useHash) hash.near(f.x, f.y, visit);
    else for (let j = 0; j < fish.length; j++) visit(j);

    let x = sx * p.separation;
    let y = sy * p.separation;
    if (n) {
      x += (cx / n - f.x) * p.cohesion + (vx / n - f.vx) * p.alignment;
      y += (cy / n - f.y) * p.cohesion + (vy / n - f.vy) * p.alignment;
    }
    const t = inf.target;
    if (t) {
      const dx = t.x - f.x;
      const dy = t.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < t.range && d > 1) {
        x += (dx / d) * t.pull;
        y += (dy / d) * t.pull;
      }
    }
    for (const r of inf.ripples ?? []) {
      const dx = f.x - r.x;
      const dy = f.y - r.y;
      const d = Math.hypot(dx, dy) + 1e-6;
      if (Math.abs(d - r.radius) < 40) {
        x += (dx / d) * r.strength;
        y += (dy / d) * r.strength;
      }
    }
    if (f.x < p.margin) x += (p.margin - f.x) * p.wall;
    if (f.x > width - p.margin) x -= (f.x - (width - p.margin)) * p.wall;
    if (f.y < p.margin) y += (p.margin - f.y) * p.wall;
    if (f.y > height - p.margin) y -= (f.y - (height - p.margin)) * p.wall;
    ax[i] = x;
    ay[i] = y;
  }

  // apply after everyone has decided, so the order of the array doesn't matter
  for (let i = 0; i < fish.length; i++) {
    const f = fish[i];
    f.vx += ax[i] * dt;
    f.vy += ay[i] * dt;
    const s = Math.hypot(f.vx, f.vy) || 1;
    const c = Math.min(p.maxSpeed, Math.max(p.minSpeed, s));
    f.vx *= c / s;
    f.vy *= c / s;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
  return checks;
}
