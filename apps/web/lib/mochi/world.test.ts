import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REACH, findRoute, jumpArc, jumpBetween, surfaceBelow, type Platform, type Step } from "./world.ts";

const ground: Platform = { id: "ground", x0: 0, x1: 1000, y: 800 };
/** A little staircase of sills, each one jump above the last, drifting right. */
const stairs: Platform[] = [
  ground,
  { id: "s1", x0: 200, x1: 300, y: 660 },
  { id: "s2", x0: 360, x1: 460, y: 520 },
  { id: "s3", x0: 520, x1: 620, y: 380 },
];

const jumps = (steps: Step[]) => steps.filter((s) => s.kind === "jump").map((s) => (s.kind === "jump" ? s.to.pid : ""));

test("surfaceBelow finds the highest ledge under a point", () => {
  assert.equal(surfaceBelow(stairs, 250, 0)?.id, "s1");
  assert.equal(surfaceBelow(stairs, 250, 700)?.id, "ground");
  assert.equal(surfaceBelow(stairs, 50, 0)?.id, "ground");
  assert.equal(surfaceBelow(stairs, 2000, 0), null);
});

test("a ledge too high is out of reach; one within reach isn't", () => {
  const low = { id: "low", x0: 100, x1: 200, y: 700 };
  const high = { id: "high", x0: 100, x1: 200, y: 700 - DEFAULT_REACH.up - 1 };
  assert.ok(jumpBetween(ground, low, 150));
  assert.equal(jumpBetween(ground, high, 150), null);
  // dropping down is always fine
  assert.ok(jumpBetween(high, ground, 150));
});

test("walking along the ground needs no jumps", () => {
  const route = findRoute(stairs, { pid: "ground", x: 50, y: 800 }, { pid: "ground", x: 900, y: 800 });
  assert.deepEqual(route, [{ kind: "walk", pid: "ground", from: 50, to: 900, y: 800 }]);
});

test("she climbs the staircase one sill at a time to reach the top", () => {
  const route = findRoute(stairs, { pid: "ground", x: 50, y: 800 }, { pid: "s3", x: 570, y: 380 });
  assert.ok(route);
  assert.deepEqual(jumps(route), ["s1", "s2", "s3"]);
  // every step starts where the previous one ended
  let at = { x: 50, y: 800 };
  for (const s of route) {
    const from = s.kind === "walk" ? { x: s.from, y: s.y } : s.from;
    assert.ok(Math.abs(from.x - at.x) < 0.01 && Math.abs(from.y - at.y) < 0.01, "steps are continuous");
    at = s.kind === "walk" ? { x: s.to, y: s.y } : s.to;
  }
  assert.deepEqual(at, { x: 570, y: 380 });
});

test("coming down, she drops straight to the goal rather than retracing the stairs", () => {
  const route = findRoute(stairs, { pid: "s3", x: 570, y: 380 }, { pid: "ground", x: 600, y: 800 });
  assert.ok(route);
  assert.deepEqual(jumps(route), ["ground"]);
});

test("an unreachable ledge gives no route", () => {
  const island = { id: "island", x0: 900, x1: 950, y: 100 };
  assert.equal(findRoute([...stairs, island], { pid: "ground", x: 50, y: 800 }, { pid: "island", x: 920, y: 100 }), null);
});

test("jump arcs start and end where they should and rise above both ends", () => {
  const from = { x: 100, y: 500 };
  const to = { x: 260, y: 380 };
  const arc = jumpArc(from, to);
  const a = arc.at(0);
  const b = arc.at(arc.duration);
  assert.ok(Math.abs(a.x - from.x) < 1e-6 && Math.abs(a.y - from.y) < 1e-6);
  assert.ok(Math.abs(b.x - to.x) < 1e-6 && Math.abs(b.y - to.y) < 1e-6);
  const mid = arc.at(arc.duration / 2);
  assert.ok(arc.at(0).vy < 0 && b.vy > 0, "goes up, then comes down");
  assert.ok(Math.min(...Array.from({ length: 50 }, (_, i) => arc.at((i / 49) * arc.duration).y)) < to.y, "clears the higher ledge");
  assert.ok(mid.x > from.x && mid.x < to.x);
});
