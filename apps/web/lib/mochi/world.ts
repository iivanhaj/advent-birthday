/**
 * Mochi's world: the page, seen as a platformer level.
 *
 * Any element marked `data-mochi-platform` (window sills, the bench, cards)
 * becomes a ledge: its top edge is something she can stand on. The bottom of
 * the screen is the ground. Ledges are one-way, like in most platformers: she
 * can jump up through them from below and land on top.
 *
 * Getting somewhere is a search problem. A state is "standing on ledge P at x".
 * From there she can walk along P, or jump to any ledge within reach. A*
 * finds the cheapest route (walking distance plus a cost per jump), guided by
 * the straight-line distance to the goal. Jumps follow a real ballistic arc.
 *
 * Everything here is pure (numbers in, numbers out), so it's unit-tested.
 * Coordinates are screen pixels, y pointing down.
 */

export type Platform = { id: string; x0: number; x1: number; y: number };
export type Point = { x: number; y: number };
export type Spot = Point & { pid: string };

export type Step =
  | { kind: "walk"; pid: string; from: number; to: number; y: number }
  | { kind: "jump"; from: Spot; to: Spot };

export type Reach = {
  /** Highest she can jump up, in px. */
  up: number;
  /** Widest gap she can cross, in px. */
  gap: number;
  /** Cost of one jump, in px of walking: she'd rather walk a bit than hop. */
  jumpCost: number;
  /** How far from a ledge's ends she likes to land (so she doesn't hang off them). */
  inset: number;
};

export const DEFAULT_REACH: Reach = { up: 170, gap: 150, jumpCost: 90, inset: 10 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Keep x on the standable part of a ledge. */
function onLedge(p: Platform, x: number, inset: number) {
  const lo = p.x0 + Math.min(inset, (p.x1 - p.x0) / 2);
  const hi = p.x1 - Math.min(inset, (p.x1 - p.x0) / 2);
  return clamp(x, lo, hi);
}

/**
 * The surface under a point: the highest ledge at or below `y` that spans `x`,
 * or null. This is where a falling piece of kibble lands, and where she'd
 * stand to be "under" your cursor.
 */
export function surfaceBelow(platforms: Platform[], x: number, y: number): Platform | null {
  let best: Platform | null = null;
  for (const p of platforms) {
    if (x >= p.x0 && x <= p.x1 && p.y >= y - 0.5 && (!best || p.y < best.y)) best = p;
  }
  return best;
}

/**
 * Can she jump from ledge a to ledge b, and if so, from where to where?
 * Takeoff is the point on `a` nearest to `b`, the landing is the point on `b`
 * nearest to that. Going up is limited by `reach.up`; dropping down isn't.
 */
export function jumpBetween(a: Platform, b: Platform, fromX: number, reach: Reach = DEFAULT_REACH): { takeoff: number; land: number } | null {
  if (a.id === b.id) return null;
  const climb = a.y - b.y; // > 0 means b is higher
  if (climb > reach.up) return null;
  const gap = b.x0 > a.x1 ? b.x0 - a.x1 : a.x0 > b.x1 ? a.x0 - b.x1 : 0;
  if (gap > reach.gap + Math.max(0, -climb) * 0.5) return null; // falling buys a little extra distance
  // Overlapping ledges: jump straight up/down from where she stands (if it's over the other ledge).
  const overlap0 = Math.max(a.x0, b.x0);
  const overlap1 = Math.min(a.x1, b.x1);
  let takeoff: number;
  if (overlap1 >= overlap0) takeoff = clamp(fromX, overlap0, overlap1);
  else takeoff = b.x0 > a.x1 ? a.x1 : a.x0;
  takeoff = onLedge(a, takeoff, reach.inset);
  const land = onLedge(b, takeoff + (b.x0 > a.x1 ? reach.inset * 2 : b.x1 < a.x0 ? -reach.inset * 2 : 0), reach.inset);
  return { takeoff, land };
}

/** A small binary heap, so A* pops the cheapest frontier state in O(log n). */
class Heap<T> {
  private items: { f: number; v: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(v: T, f: number) {
    const a = this.items;
    a.push({ f, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0].v;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * The cheapest route from `start` to the point `goal` on ledge `goal.pid`, as
 * a list of walk and jump steps, or null if it can't be reached.
 *
 * States are (ledge, x). Edges: a jump to any reachable ledge, costing the
 * walk to the takeoff point plus `jumpCost` plus the jump's length. The
 * heuristic is the straight-line distance to the goal, which never
 * overestimates (no route is shorter than a straight line), so A* explores the
 * promising ledges first. Costs are remembered per ledge rather than per exact
 * landing point: that keeps the search tiny, at the price of occasionally
 * missing a route that's a few pixels shorter. Fine for a cat.
 */
export function findRoute(platforms: Platform[], start: Spot, goal: Spot, reach: Reach = DEFAULT_REACH): Step[] | null {
  const byId = new Map(platforms.map((p) => [p.id, p]));
  if (!byId.has(start.pid) || !byId.has(goal.pid)) return null;

  type Node = { pid: string; x: number; g: number; steps: Step[] };
  const h = (pid: string, x: number) => Math.hypot(goal.x - x, goal.y - byId.get(pid)!.y);
  const open = new Heap<Node>();
  const best = new Map<string, number>(); // cheapest cost seen to *enter* each ledge
  open.push({ pid: start.pid, x: start.x, g: 0, steps: [] }, h(start.pid, start.x));
  best.set(start.pid, 0);

  let expanded = 0;
  while (open.size) {
    const n = open.pop()!;
    if (++expanded > 4000) break; // safety valve: never stall a frame
    const here = byId.get(n.pid)!;

    if (n.pid === goal.pid) {
      const to = onLedge(here, goal.x, 0);
      const steps = [...n.steps];
      if (Math.abs(to - n.x) > 0.5) steps.push({ kind: "walk", pid: n.pid, from: n.x, to, y: here.y });
      return steps;
    }

    for (const next of platforms) {
      const j = jumpBetween(here, next, n.x, reach);
      if (!j) continue;
      const walk = Math.abs(j.takeoff - n.x);
      const flight = Math.hypot(j.land - j.takeoff, next.y - here.y);
      const g = n.g + walk + reach.jumpCost + flight;
      if (g >= (best.get(next.id) ?? Infinity)) continue;
      best.set(next.id, g);
      const steps: Step[] = [...n.steps];
      if (walk > 0.5) steps.push({ kind: "walk", pid: n.pid, from: n.x, to: j.takeoff, y: here.y });
      steps.push({ kind: "jump", from: { pid: here.id, x: j.takeoff, y: here.y }, to: { pid: next.id, x: j.land, y: next.y } });
      open.push({ pid: next.id, x: j.land, g, steps }, g + h(next.id, j.land));
    }
  }
  return null;
}

/**
 * A ballistic jump from `from` to `to` under gravity `g` (px/s²).
 *
 * She always clears a little above the higher end (an apex), so the arc is
 * fixed by three facts: start, end, apex height. Solving the projectile
 * equations gives the launch speed and the flight time; `at(t)` is then the
 * textbook position y = y₀ + v₀t + ½gt².
 */
export function jumpArc(from: Point, to: Point, g = 2600) {
  const dx = to.x - from.x;
  const apexY = Math.min(from.y, to.y) - (24 + Math.abs(dx) * 0.18);
  const vy0 = -Math.sqrt(2 * g * (from.y - apexY));
  const tUp = -vy0 / g;
  const tDown = Math.sqrt((2 * (to.y - apexY)) / g);
  const duration = tUp + tDown;
  const vx = dx / duration;
  return {
    duration,
    at(t: number): Point & { vy: number } {
      const s = clamp(t, 0, duration);
      return { x: from.x + vx * s, y: from.y + vy0 * s + 0.5 * g * s * s, vy: vy0 + g * s };
    },
  };
}
