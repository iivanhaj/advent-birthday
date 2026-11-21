import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FLOCK, SpatialHash, neighboursBrute, neighboursHashed, stepFlock, type Fish } from "./flock.ts";
import { KOI_COLOURS, koiFor } from "./koi.ts";

/** A seeded pond, so failures are reproducible. */
function pond(n: number, schools = 4, seed = 1): Fish[] {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, i) => ({ x: r() * 900, y: r() * 600, vx: (r() - 0.5) * 80, vy: (r() - 0.5) * 80, school: i % schools }));
}

test("the spatial hash finds exactly the same neighbours as checking everyone", () => {
  const fish = pond(400);
  const r = DEFAULT_FLOCK.sight;
  const hash = new SpatialHash(r, Math.ceil(900 / r));
  hash.build(fish);
  for (let i = 0; i < fish.length; i += 7) assert.deepEqual(neighboursHashed(fish, i, r, hash), neighboursBrute(fish, i, r));
});

test("hashing does far fewer checks than brute force, for the same result", () => {
  const a = pond(600);
  const b = a.map((f) => ({ ...f }));
  const hashed = stepFlock(a, 900, 600, 1 / 60, DEFAULT_FLOCK, {}, true);
  const brute = stepFlock(b, 900, 600, 1 / 60, DEFAULT_FLOCK, {}, false);
  assert.ok(hashed < brute / 5, `hashed ${hashed} vs brute ${brute}`);
  for (let i = 0; i < a.length; i++) {
    assert.ok(Math.abs(a[i].x - b[i].x) < 1e-9 && Math.abs(a[i].vy - b[i].vy) < 1e-9, "same motion either way");
  }
});

test("speeds stay between the limits", () => {
  const fish = pond(200);
  for (let k = 0; k < 120; k++) stepFlock(fish, 900, 600, 1 / 60);
  for (const f of fish) {
    const s = Math.hypot(f.vx, f.vy);
    assert.ok(s >= DEFAULT_FLOCK.minSpeed - 1e-6 && s <= DEFAULT_FLOCK.maxSpeed + 1e-6);
  }
});

test("two koi that are too close push apart", () => {
  const fish: Fish[] = [
    { x: 300, y: 300, vx: 40, vy: 0, school: 0 },
    { x: 306, y: 300, vx: 40, vy: 0, school: 1 },
  ];
  const before = fish[1].x - fish[0].x;
  for (let k = 0; k < 20; k++) stepFlock(fish, 900, 600, 1 / 60);
  assert.ok(fish[1].x - fish[0].x > before);
});

test("koi stay in the pond", () => {
  const fish = pond(150);
  for (let k = 0; k < 900; k++) stepFlock(fish, 900, 600, 1 / 60);
  for (const f of fish) assert.ok(f.x > -20 && f.x < 920 && f.y > -20 && f.y < 620, `escaped to ${f.x},${f.y}`);
});

test("a school gathers together instead of scattering across the pond", () => {
  const fish = pond(120, 2, 3);
  for (let k = 0; k < 1200; k++) stepFlock(fish, 900, 600, 1 / 60);
  const centre = (s: number) => {
    const m = fish.filter((f) => f.school === s);
    return { x: m.reduce((a, f) => a + f.x, 0) / m.length, y: m.reduce((a, f) => a + f.y, 0) / m.length };
  };
  // within-school spread is smaller than the pond itself: they've gathered
  for (const s of [0, 1]) {
    const c = centre(s);
    const spread = fish.filter((f) => f.school === s).reduce((a, f) => a + Math.hypot(f.x - c.x, f.y - c.y), 0) / 60;
    assert.ok(spread < 260, `school ${s} spread ${spread}`);
  }
});

test("a push always becomes the same koi, coloured by what it touched", () => {
  const push = { delivery_id: "d1", sha: "abc123", files: { ts: 5, css: 2, md: 1 } };
  assert.deepEqual(koiFor(push, 2), koiFor(push, 2));
  const k = koiFor(push, 2);
  assert.equal(k.school, 2);
  assert.deepEqual(k.patches.map((p) => p.colour), [KOI_COLOURS.ts, KOI_COLOURS.css, KOI_COLOURS.md]);
  assert.notDeepEqual(koiFor({ ...push, sha: "def456" }, 2).patches, k.patches);
});

test("bigger pushes are bigger koi, and a push with no file info still gets a koi", () => {
  const small = koiFor({ delivery_id: "a", sha: "1", files: { ts: 1 } }, 0);
  const big = koiFor({ delivery_id: "b", sha: "2", files: { ts: 40, sql: 10 } }, 0);
  assert.ok(big.length > small.length);
  const bare = koiFor({ delivery_id: "c", sha: null, files: null }, 0);
  assert.equal(bare.patches[0].colour, KOI_COLOURS.other);
});
