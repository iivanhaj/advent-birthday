import { test } from "node:test";
import assert from "node:assert/strict";
import { DIMS, SONGS } from "./songs.ts";
import { MOODS, balancedAssign, buildCarousels, cluster, dist2, loopLength, mulberry32, nameCentres, ringOrder, seedCentres, tune } from "./mood.ts";

test("every song has a Spotify ID, a title and a six-score mood from 0 to 4", () => {
  assert.ok(SONGS.length >= 80);
  assert.equal(new Set(SONGS.map((s) => s.id)).size, SONGS.length);
  for (const s of SONGS) {
    assert.match(s.id, /^[A-Za-z0-9]{22}$/);
    assert.ok(s.title && s.artist);
    assert.equal(s.mood.length, DIMS.length);
    assert.ok(s.mood.every((x) => Number.isInteger(x) && x >= 0 && x <= 4));
  }
});

test("k-means++ starts from real, distinct points", () => {
  const pts = [[0, 0], [0, 1], [10, 10], [10, 11], [20, 0]];
  const c = seedCentres(pts, 3, mulberry32(1));
  assert.equal(c.length, 3);
  for (const p of c) assert.ok(pts.some((q) => dist2(p, q) === 0));
  assert.equal(new Set(c.map(String)).size, 3);
});

test("balanced assignment never overfills a group", () => {
  const pts = Array.from({ length: 10 }, (_, i) => [i < 8 ? 0 : 10, 0]);
  const labels = balancedAssign(pts, [[0, 0], [10, 0]], 5);
  assert.equal(labels.filter((l) => l === 0).length, 5);
  assert.equal(labels.filter((l) => l === 1).length, 5);
  assert.ok(labels.every((l) => l >= 0));
});

test("clustering finds obvious groups and is deterministic", () => {
  const pts = [[0, 0], [0, 1], [1, 0], [9, 9], [9, 10], [10, 9]];
  const a = cluster(pts, 2);
  const b = cluster(pts, 2);
  assert.deepEqual(a.labels, b.labels);
  assert.equal(a.labels[0], a.labels[1]);
  assert.equal(a.labels[0], a.labels[2]);
  assert.notEqual(a.labels[0], a.labels[3]);
});

test("names go to the closest moods", () => {
  const order = [3, 0, 4, 1, 2];
  const centres = order.map((m) => MOODS[m].proto);
  assert.deepEqual(nameCentres(centres), order);
});

test("2-opt untangles a crossed loop", () => {
  // a square visited corner, opposite corner, ...: the loop crosses itself
  const sq = [[0, 0], [1, 1], [1, 0], [0, 1]];
  const order = ringOrder(sq);
  assert.equal(order.length, 4);
  assert.ok(Math.abs(loopLength(sq, order) - 4) < 1e-9);
});

test("the ring is never longer than the plain playlist order", () => {
  const pts = SONGS.slice(0, 18).map((s) => s.mood);
  const plain = pts.map((_, i) => i);
  const ring = ringOrder(pts);
  assert.deepEqual([...ring].sort((a, b) => a - b), plain);
  assert.ok(loopLength(pts, ring) <= loopLength(pts, plain));
});

test("five full carousels hold every song exactly once", () => {
  const cars = buildCarousels();
  assert.equal(cars.length, 5);
  assert.deepEqual(cars.map((c) => c.mood.id), MOODS.map((m) => m.id));
  const cap = Math.ceil(SONGS.length / 5);
  for (const c of cars) assert.ok(c.songs.length >= cap - 2 && c.songs.length <= cap, `${c.mood.label}: ${c.songs.length}`);
  const ids = cars.flatMap((c) => c.songs.map((s) => s.id));
  assert.equal(ids.length, SONGS.length);
  assert.equal(new Set(ids).size, SONGS.length);
});

test("songs land in the mood that sounds like them", () => {
  const cars = buildCarousels();
  const where = (title: string) => cars.find((c) => c.songs.some((s) => s.title === title))!.mood.id;
  assert.equal(where("OMG"), "bright");
  assert.equal(where("Astronomy"), "feelings");
  assert.equal(where("Cigarette"), "drive");
});

test("each song's music box tune is its own, stays in its scale and ends home", () => {
  const m = MOODS[0];
  const a = tune(SONGS[0].id, m);
  assert.deepEqual(a, tune(SONGS[0].id, m));
  assert.notDeepEqual(a, tune(SONGS[1].id, m));
  for (const [n, len] of a) {
    assert.ok(m.scale.includes(n));
    assert.ok(len > 0);
  }
  assert.equal(a[a.length - 1][0], 0);
});
