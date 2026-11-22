/**
 * Door 5 · the infinite bloom. The maths, pure and unit-tested.
 *
 * A flower is drawn at a "frame": centre (x, y), size, rotation and level.
 * Each of its N petals holds a child flower, `ratio` times smaller, sitting
 * `dist` of the way out along the petal and turned by `twist`. So the
 * flower is self-similar: the step from a flower to its first child is one
 * fixed similarity transform M (scale, rotate, shift).
 *
 * The camera zooms along M continuously. M has a fixed point F (the spot the
 * zoom converges to), and its t-th power is easy around F:
 *
 *   M^t(p) = F + ratio^t · Rot(t · twist) · (p − F)
 *
 * The camera shows the world through M^(−t). At t = 1 it shows the first
 * child exactly where the root was at t = 0, so t can wrap from 1 back to 0
 * with no visible seam, and the zoom goes on forever. Wrapping also keeps
 * the numbers small: we never actually zoom past one level, which is why
 * there's no floating-point "deep zoom" problem.
 */

export type BloomParams = { petals: number; ratio: number; dist: number; twist: number };
export type Frame = { x: number; y: number; size: number; rot: number; level: number };

export const DEFAULT_BLOOM: BloomParams = { petals: 6, ratio: 0.27, dist: 0.6, twist: 0.55 };

/** Petal 0 points straight up (screen y grows downward). */
export const UP = -Math.PI / 2;

/** The child flower sitting in petal `i` of `f`. */
export function childFrame(f: Frame, i: number, p: BloomParams): Frame {
  const a = f.rot + UP + (i / p.petals) * Math.PI * 2;
  return {
    x: f.x + Math.cos(a) * f.size * p.dist,
    y: f.y + Math.sin(a) * f.size * p.dist,
    size: f.size * p.ratio,
    rot: f.rot + (i / p.petals) * Math.PI * 2 + p.twist,
    level: f.level + 1,
  };
}

/**
 * The self-similarity map M_k applied to a point: root frame → the frame of
 * the child in petal k. (M_k is M_0 followed by a turn of k petals about the
 * root's centre; the camera dives into whichever petal k you pick.)
 */
export function selfMap(px: number, py: number, p: BloomParams, k = 0): [number, number] {
  const turn = (k / p.petals) * Math.PI * 2;
  const c = Math.cos(p.twist + turn) * p.ratio;
  const s = Math.sin(p.twist + turn) * p.ratio;
  const dx = Math.cos(UP + turn) * p.dist;
  const dy = Math.sin(UP + turn) * p.dist;
  return [dx + c * px - s * py, dy + s * px + c * py];
}

/** The point M_k leaves where it is: F = (I − A)⁻¹ · d, for M(p) = A·p + d. */
export function fixedPoint(p: BloomParams, k = 0): [number, number] {
  const turn = (k / p.petals) * Math.PI * 2;
  const a = Math.cos(p.twist + turn) * p.ratio;
  const b = -Math.sin(p.twist + turn) * p.ratio;
  const c = Math.sin(p.twist + turn) * p.ratio;
  const d = Math.cos(p.twist + turn) * p.ratio;
  const dx = Math.cos(UP + turn) * p.dist;
  const dy = Math.sin(UP + turn) * p.dist;
  const det = (1 - a) * (1 - d) - b * c;
  return [((1 - d) * dx + b * dy) / det, (c * dx + (1 - a) * dy) / det];
}

export type Camera = { cx: number; cy: number; zoom: number; angle: number; fx: number; fy: number };

/**
 * The camera at zoom phase t ∈ [0, 1): world point p appears on screen at
 * centre + zoom · Rot(angle) · (p − F). `spin` turns the whole picture (to
 * dive into a different petal; the flower looks the same turned by 2π/N).
 */
export function cameraAt(t: number, p: BloomParams, width: number, height: number, k = 0): Camera {
  const [fx, fy] = fixedPoint(p, k);
  const turn = (k / p.petals) * Math.PI * 2;
  return { cx: width / 2, cy: height / 2, zoom: Math.min(width, height) * 0.46 * Math.pow(p.ratio, -t), angle: -t * (p.twist + turn), fx, fy };
}

export function toScreen(cam: Camera, px: number, py: number): [number, number] {
  const qx = px - cam.fx;
  const qy = py - cam.fy;
  const c = Math.cos(cam.angle);
  const s = Math.sin(cam.angle);
  return [cam.cx + cam.zoom * (c * qx - s * qy), cam.cy + cam.zoom * (s * qx + c * qy)];
}

/**
 * The flower to start drawing from, in screen space: `up` levels above the
 * root (so the screen is always covered by an ancestor's petals, never empty
 * paper), already transformed by the camera.
 */
export function startFrame(cam: Camera, p: BloomParams, up = 3, k = 0): Frame {
  // walk up: parent = M_k⁻¹(child frame)
  const turn = (k / p.petals) * Math.PI * 2;
  let x = 0, y = 0, size = 1, rot = 0;
  const c = Math.cos(-(p.twist + turn)), s = Math.sin(-(p.twist + turn));
  const dx = Math.cos(UP + turn) * p.dist, dy = Math.sin(UP + turn) * p.dist;
  for (let j = 0; j < up; j++) {
    const px = x - dx, py = y - dy;
    x = (c * px - s * py) / p.ratio;
    y = (s * px + c * py) / p.ratio;
    size /= p.ratio;
    rot -= p.twist + turn;
  }
  const [sx, sy] = toScreen(cam, x, y);
  return { x: sx, y: sy, size: size * cam.zoom, rot: rot + cam.angle, level: -up };
}

export const FLOATS_PER_FLOWER = 5;

/**
 * How far (in flower sizes) a flower *and everything nested inside it* can
 * reach from its centre. Its own petals reach 1; a child sits `dist` out and
 * reaches `ratio` × the same again, so the bound R solves R = max(1, dist +
 * ratio · R): R = max(1, dist / (1 − ratio)). Culling by this is exact: if a
 * flower's reach is off screen, its whole subtree is too.
 */
export function subtreeReach(p: BloomParams): number {
  return Math.max(1, p.dist / (1 - p.ratio)) * 1.02;
}

/**
 * Walk the infinite tree from `start` and write every flower that is on
 * screen and at least `minSize` px across into `out` (x, y, size, rot, level),
 * parents before children (so children draw on top). A flower that's off
 * screen or too small is skipped along with its whole subtree: everything
 * inside it is smaller still and lies within its bounds. Returns the count.
 *
 * An explicit stack instead of recursion: same order, no call overhead, and
 * the same algorithm the Rust/WASM version runs.
 */
export function walk(start: Frame, p: BloomParams, width: number, height: number, minSize: number, out: Float32Array): number {
  const max = Math.floor(out.length / FLOATS_PER_FLOWER);
  const stack: Frame[] = [start];
  let n = 0;
  const reach = subtreeReach(p);
  while (stack.length && n < max) {
    const f = stack.pop()!;
    const r = f.size * reach;
    if (f.size < minSize || f.x + r < 0 || f.x - r > width || f.y + r < 0 || f.y - r > height) continue;
    out.set([f.x, f.y, f.size, f.rot, f.level], n * FLOATS_PER_FLOWER);
    n++;
    // push in reverse so petal 0's child pops first (pre-order, petal order)
    for (let i = p.petals - 1; i >= 0; i--) stack.push(childFrame(f, i, p));
  }
  return n;
}
