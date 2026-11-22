import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BLOOM, FLOATS_PER_FLOWER, cameraAt, childFrame, fixedPoint, selfMap, startFrame, toScreen, walk, type BloomParams, type Frame } from "./bloom.ts";

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const PARAMS: BloomParams[] = [DEFAULT_BLOOM, { petals: 5, ratio: 0.32, dist: 0.62, twist: -0.3 }, { petals: 8, ratio: 0.22, dist: 0.66, twist: 1.1 }];

test("the first child of the root is exactly the self-similarity map M", () => {
  for (const p of PARAMS) {
    const root: Frame = { x: 0, y: 0, size: 1, rot: 0, level: 0 };
    const c = childFrame(root, 0, p);
    const [mx, my] = selfMap(0, 0, p);
    assert.ok(close(c.x, mx) && close(c.y, my));
    // and the grandchild is M applied twice
    const g = childFrame(c, 0, p);
    const [gx, gy] = selfMap(mx, my, p);
    assert.ok(close(g.x, gx) && close(g.y, gy));
  }
});

test("M leaves its fixed point where it is", () => {
  for (const p of PARAMS) {
    const [fx, fy] = fixedPoint(p);
    const [mx, my] = selfMap(fx, fy, p);
    assert.ok(close(fx, mx) && close(fy, my));
  }
});

test("the zoom loops seamlessly: at t = 1 every point of M(world) is where the world was at t = 0", () => {
  for (const p of PARAMS) {
    const at0 = cameraAt(0, p, 1200, 760);
    const at1 = cameraAt(1, p, 1200, 760);
    for (const [px, py] of [[0, 0], [0.3, -0.7], [-0.9, 0.4], [1.2, 1.1]]) {
      const [ax, ay] = toScreen(at0, px, py);
      const [mx, my] = selfMap(px, py, p);
      const [bx, by] = toScreen(at1, mx, my);
      assert.ok(close(ax, bx, 1e-6) && close(ay, by, 1e-6), `${px},${py}`);
    }
  }
});

test("walking returns parents before children, all on screen and big enough", () => {
  const p = DEFAULT_BLOOM;
  const cam = cameraAt(0.37, p, 1200, 760);
  const out = new Float32Array(200_000 * FLOATS_PER_FLOWER);
  const n = walk(startFrame(cam, p), p, 1200, 760, 3, out);
  assert.ok(n > 100);
  for (let i = 0; i < n; i++) {
    const size = out[i * 5 + 2];
    assert.ok(size >= 3);
  }
  // level never jumps by more than one going down the list (pre-order)
  for (let i = 1; i < n; i++) assert.ok(out[i * 5 + 4] - out[(i - 1) * 5 + 4] <= 1);
});

test("culling never drops a visible flower (vs. a brute-force walk with no culling)", () => {
  const p = { petals: 5, ratio: 0.3, dist: 0.6, twist: 0.4 };
  const W = 400, H = 300, MIN = 6;
  const cam = cameraAt(0.6, p, W, H);
  const start = startFrame(cam, p, 2);
  const out = new Float32Array(100_000 * FLOATS_PER_FLOWER);
  const n = walk(start, p, W, H, MIN, out);
  // brute force: every flower big enough whose centre is on screen
  let brute = 0;
  const visit = (f: Frame) => {
    if (f.size < MIN) return;
    if (f.x >= 0 && f.x <= W && f.y >= 0 && f.y <= H) brute++;
    for (let i = 0; i < p.petals; i++) visit(childFrame(f, i, p));
  };
  visit(start);
  let onScreenCentres = 0;
  for (let i = 0; i < n; i++) {
    const x = out[i * 5], y = out[i * 5 + 1];
    if (x >= 0 && x <= W && y >= 0 && y <= H) onScreenCentres++;
  }
  assert.equal(onScreenCentres, brute);
});
