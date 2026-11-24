import { SONGS, type Song, type Vec } from "./songs.ts";

/**
 * Door 7 · the firefly carousel. From mood vectors to five carousels.
 *
 *  1. k-means++ picks five far-apart starting centres; k-means then moves
 *     them to the middle of their songs. Several seeded restarts, keep the
 *     tightest (lowest total squared distance).
 *  2. Balanced: plain k-means can put 30 songs in one group and 6 in another,
 *     and a carousel wants a full ring. So assignment hands out the closest
 *     (song, group) pairs first and stops filling a group at ⌈n / k⌉.
 *  3. Each group is named by matching its centre to five named moods, trying
 *     every pairing (5! = 120) and keeping the closest overall.
 *  4. Around the ring, neighbours should sound alike: a nearest-neighbour tour,
 *     then 2-opt (reverse any stretch that makes the loop shorter) until no
 *     reversal helps.
 */

export type MoodId = "sleepy" | "drive" | "bright" | "feelings" | "falling";
export type Mood = {
  id: MoodId;
  label: string;
  /** What a song in this mood sounds like, in the six dims of songs.ts. */
  proto: Vec;
  /** The music box's scale (semitones above the root) and seconds per note. */
  scale: number[];
  beat: number;
};

export const MOODS: Mood[] = [
  { id: "sleepy", label: "soft and sleepy", proto: [1, 2, 1, 1, 4, 2], scale: [0, 2, 4, 7, 9, 12, 14], beat: 0.42 },
  { id: "drive", label: "late-night drive", proto: [2, 2, 2, 3, 2, 4], scale: [0, 3, 5, 7, 10, 12, 15], beat: 0.34 },
  { id: "bright", label: "bright and bouncy", proto: [4, 4, 2, 0, 1, 1], scale: [0, 2, 4, 5, 7, 9, 12], beat: 0.22 },
  { id: "feelings", label: "in my feelings", proto: [1, 0, 1, 4, 3, 2], scale: [0, 2, 3, 7, 8, 12, 14], beat: 0.5 },
  { id: "falling", label: "falling for someone", proto: [2, 3, 4, 1, 2, 1], scale: [0, 4, 7, 9, 11, 12, 16], beat: 0.3 },
];

/** A small seeded PRNG, so the clusters are the same on every build. */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist2 = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);

function mean(points: Vec[], dims: number): Vec {
  const m = new Array(dims).fill(0);
  for (const p of points) p.forEach((x, i) => (m[i] += x / points.length));
  return m;
}

/** k-means++: each new centre is picked with probability ∝ squared distance to the nearest one so far. */
export function seedCentres(points: Vec[], k: number, rnd: () => number): Vec[] {
  const c = [points[Math.floor(rnd() * points.length)]];
  while (c.length < k) {
    const d = points.map((p) => Math.min(...c.map((q) => dist2(p, q))));
    let r = rnd() * d.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < d.length - 1 && (r -= d[i]) > 0) i++;
    c.push(points[i]);
  }
  return c.map((p) => [...p]);
}

/** Closest pairs first; a group takes no more than `cap` points. */
export function balancedAssign(points: Vec[], centres: Vec[], cap: number): number[] {
  const pairs: [number, number, number][] = [];
  points.forEach((p, i) => centres.forEach((c, j) => pairs.push([dist2(p, c), i, j])));
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const label = new Array(points.length).fill(-1);
  const size = new Array(centres.length).fill(0);
  for (const [, i, j] of pairs) {
    if (label[i] >= 0 || size[j] >= cap) continue;
    label[i] = j;
    size[j]++;
  }
  return label;
}

export function cluster(points: Vec[], k: number, seed = 7, restarts = 12) {
  const cap = Math.ceil(points.length / k);
  const dims = points[0].length;
  let best: { labels: number[]; centres: Vec[]; inertia: number } | null = null;
  for (let r = 0; r < restarts; r++) {
    const rnd = mulberry32(seed + r * 7919);
    let centres = seedCentres(points, k, rnd);
    let labels: number[] = [];
    for (let it = 0; it < 50; it++) {
      const next = balancedAssign(points, centres, cap);
      const same = next.every((l, i) => l === labels[i]);
      labels = next;
      centres = centres.map((c, j) => {
        const mine = points.filter((_, i) => labels[i] === j);
        return mine.length ? mean(mine, dims) : c;
      });
      if (same) break;
    }
    const inertia = points.reduce((s, p, i) => s + dist2(p, centres[labels[i]]), 0);
    if (!best || inertia < best.inertia) best = { labels, centres, inertia };
  }
  return best!;
}

function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}

/** The pairing of centres to named moods with the smallest total distance: name[j] is centre j's mood index. */
export function nameCentres(centres: Vec[], moods = MOODS): number[] {
  let best: number[] = [];
  let bestCost = Infinity;
  for (const p of permutations(centres.length)) {
    const cost = p.reduce((s, m, j) => s + dist2(centres[j], moods[m].proto), 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = p;
    }
  }
  return best;
}

/** Length of the closed loop through `order`. */
export const loopLength = (points: Vec[], order: number[]) => order.reduce((s, i, k) => s + Math.sqrt(dist2(points[i], points[order[(k + 1) % order.length]])), 0);

/** A short loop through every point: nearest-neighbour, then 2-opt until nothing improves. */
export function ringOrder(points: Vec[]): number[] {
  const n = points.length;
  if (n < 4) return points.map((_, i) => i);
  const d = (a: number, b: number) => Math.sqrt(dist2(points[a], points[b]));
  const order = [0];
  const left = new Set(points.map((_, i) => i).slice(1));
  while (left.size) {
    const last = order[order.length - 1];
    let pick = -1;
    for (const j of left) if (pick < 0 || d(last, j) < d(last, pick)) pick = j;
    order.push(pick);
    left.delete(pick);
  }
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 2; j < n; j++) {
        const a = order[i], b = order[i + 1], c = order[j], e = order[(j + 1) % n];
        if (a === e) continue;
        if (d(a, c) + d(b, e) < d(a, b) + d(c, e) - 1e-9) {
          order.splice(i + 1, j - i, ...order.slice(i + 1, j + 1).reverse());
          improved = true;
        }
      }
  }
  return order;
}

export type Carousel = { mood: Mood; songs: Song[] };

/** The five carousels, in MOODS order, each ring ordered so neighbours sound alike. */
export function buildCarousels(songs: Song[] = SONGS): Carousel[] {
  const points = songs.map((s) => s.mood);
  const { labels, centres } = cluster(points, MOODS.length);
  const names = nameCentres(centres);
  return MOODS.map((mood, m) => {
    const j = names.indexOf(m);
    const mine = songs.filter((_, i) => labels[i] === j);
    // start the ring at the song closest to the group's centre, so it faces you first
    const ring = ringOrder(mine.map((s) => s.mood)).map((i) => mine[i]);
    const first = ring.reduce((b, s, i) => (dist2(s.mood, centres[j]) < dist2(ring[b].mood, centres[j]) ? i : b), 0);
    return { mood, songs: [...ring.slice(first), ...ring.slice(0, first)] };
  });
}

/**
 * The music-box tune for a song: notes from its mood's scale, seeded by its
 * Spotify ID, so each song winds up with its own little phrase.
 * Each note is [semitones above the root, length in beats].
 */
export function tune(songId: string, mood: Mood, notes = 10): [number, number][] {
  let h = 2166136261;
  for (const ch of songId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = mulberry32(h);
  let step = Math.floor(rnd() * 3);
  return Array.from({ length: notes }, (_, i) => {
    step = Math.max(0, Math.min(mood.scale.length - 1, step + Math.floor(rnd() * 5) - 2));
    const last = i === notes - 1;
    return [last ? 0 : mood.scale[step], last ? 3 : i % 4 === 3 ? 2 : 1];
  });
}
