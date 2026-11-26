import { test } from "node:test";
import assert from "node:assert/strict";
import { CAT_X, VIEW_H, airFrames, buildWorld, decodeReplay, encodeReplay, jumpHeight, roofAt, seedFor, simulate, speedAt, startState, step, type World } from "./sim.ts";

const world = buildWorld(seedFor("2026-11-26"), 40000);

test("each day has its own course, and the same day always the same", () => {
  assert.equal(seedFor("2026-11-26"), seedFor("2026-11-26"));
  assert.notEqual(seedFor("2026-11-26"), seedFor("2026-11-27"));
  assert.deepEqual(buildWorld(seedFor("2026-11-26"), 5000).roofs, buildWorld(seedFor("2026-11-26"), 5000).roofs);
});

test("every gap is shorter than a full jump at the speed she'll be going", () => {
  for (let i = 1; i < world.roofs.length; i++) {
    const a = world.roofs[i - 1], b = world.roofs[i];
    const gap = b.x - (a.x + a.w);
    assert.ok(gap >= 50, `gap ${i} too small: ${gap}`);
    assert.ok(gap < speedAt(a.x + a.w) * airFrames() * 0.7, `gap ${i} too wide: ${gap}`);
    assert.ok(b.h - a.h < jumpHeight() * 0.6, `roof ${i} too high to climb`);
  }
});

/** A robot that jumps at each roof edge, holding longer for longer gaps: if it can finish, people can. */
function robot(w: World, frames: number) {
  const s = startState(w);
  let hold = 0;
  for (let f = 0; f < frames && !s.over; f++) {
    const wx = s.dist + CAT_X;
    const r = roofAt(w, wx);
    let pressed = false;
    if (r && s.cat.onGround && r.x + r.w - wx < s.speed * 3) {
      // like a person: a short hop for a short gap, a long press for a long one
      const next = w.roofs[w.roofs.indexOf(r) + 1];
      const gap = next.x - (r.x + r.w);
      pressed = true;
      hold = gap + (next.h - r.h) > s.speed * 26 ? 26 : 9;
    }
    step(w, s, { held: hold-- > 0, pressed });
  }
  return s;
}

test("the course can be run: a robot jumping at each edge lasts a minute without birds", () => {
  const calm = { ...world, birds: [] };
  const s = robot(calm, 3600);
  assert.equal(s.over, null, `fell at frame ${s.frame}, ${Math.round(s.dist)} px`);
  assert.ok(s.stars > 5);
});

test("every day of a week is runnable, not just today", () => {
  for (let d = 24; d <= 30; d++) {
    const date = `2026-11-${d}`;
    const w = { ...buildWorld(seedFor(date), 40000), birds: [] };
    const s = robot(w, 3600);
    assert.equal(s.over, null, `${date}: fell at frame ${s.frame}`);
  }
});

test("doing nothing ends at the first gap", () => {
  const s = simulate(world, [], 2000);
  assert.ok(s.over === "fell" || s.over === "wall");
  assert.ok(s.dist > 400);
});

test("a replay round-trips and plays back to exactly the same score", () => {
  const toggles = [30, 50, 140, 170, 260, 300];
  const code = encodeReplay("2026-11-26", toggles);
  assert.match(code, /^2026-11-26~[0-9a-z.]+$/);
  const back = decodeReplay(code)!;
  assert.deepEqual(back, { date: "2026-11-26", toggles });
  const a = simulate(world, toggles, 900), b = simulate(buildWorld(seedFor(back.date), 40000), back.toggles, 900);
  assert.equal(a.score, b.score);
  assert.equal(a.dist, b.dist);
  assert.equal(a.over, b.over);
  assert.equal(decodeReplay("nonsense"), null);
});

test("arriving just under a roof's top, she scrambles up instead of hitting the wall", () => {
  const w: World = { roofs: [{ x: -200, w: 400, h: 100, deco: "none", awning: null, style: 0 }, { x: 260, w: 400, h: 130, deco: "none", awning: null, style: 0 }], items: [], birds: [] };
  const s = startState(w);
  s.dist = 260 - CAT_X - 2;
  s.cat = { ...s.cat, y: VIEW_H - 130 + 8, vy: 2, onGround: false };
  step(w, s, { held: false, pressed: false });
  assert.equal(s.over, null);
  assert.equal(s.cat.y, VIEW_H - 130);
  assert.ok(s.cat.onGround);
});

test("stars sit above the roofs, within reach", () => {
  for (const it of world.items.slice(0, 200)) {
    assert.ok(it.y < VIEW_H - 50 && it.y > 0, `item ${it.id} at ${it.y}`);
  }
});
