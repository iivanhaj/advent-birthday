import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, monthDay, mulberry32, plan, recordSeed, type Brush } from "./paint.ts";

const SONG_A = "2TEQvxxQabwLQMqWMg1qGu";
const SONG_B = "2QjOHCTQ1Jl3zawyYOpxh6";

test("monthDay keeps only the month and day, and rejects days that don't exist", () => {
  assert.equal(monthDay("2026-11-28"), "11-28");
  assert.equal(monthDay("11-28"), "11-28");
  assert.equal(monthDay("2000-2-29"), "02-29");
  assert.equal(monthDay("2026-02-30"), null);
  assert.equal(monthDay("13-01"), null);
  assert.equal(monthDay("not a date"), null);
});

test("the PRNG is deterministic and stays in [0, 1)", () => {
  const a = mulberry32(1128);
  const b = mulberry32(1128);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test("same birthday + song + theme paints exactly the same record", () => {
  for (const { id } of THEMES) assert.deepEqual(plan("11-28", SONG_A, id), plan("11-28", SONG_A, id));
});

test("a different song, or a different birthday, paints a different record", () => {
  assert.notEqual(recordSeed("11-28", SONG_A), recordSeed("11-28", SONG_B));
  assert.notEqual(recordSeed("11-28", SONG_A), recordSeed("11-29", SONG_A));
  assert.notDeepEqual(plan("11-28", SONG_A, "dreamy").brushes, plan("11-28", SONG_B, "dreamy").brushes);
});

test("themes are different recipes over the same seed", () => {
  const kinds = (t: (typeof THEMES)[number]["id"]) => new Set(plan("11-28", SONG_A, t).brushes.map((b) => b.k));
  assert.ok(kinds("dreamy").has("glitter") && kinds("dreamy").has("swirl"));
  assert.ok(kinds("meadow").has("vine") && kinds("meadow").has("leaf"));
  assert.ok(kinds("vinyl").has("label") && kinds("vinyl").has("clip"));
  // same song, same palette across themes: the record keeps its identity when you switch
  assert.equal(plan("11-28", SONG_A, "dreamy").hue, plan("11-28", SONG_A, "vinyl").hue);
});

test("every mark stays on the disc", () => {
  const where = (b: Brush): [number, number] | null => ("x" in b && "y" in b ? [b.x, b.y] : null);
  for (const { id } of THEMES)
    for (const song of [SONG_A, SONG_B])
      for (const b of plan("11-28", song, id).brushes) {
        const p = where(b);
        if (p) assert.ok(Math.hypot(p[0], p[1]) <= 1.0001, `${b.k} at ${p} is off the disc`);
        if (b.k === "swirl" || b.k === "dots" || b.k === "vine") assert.ok(b.r > 0 && b.r <= 1);
      }
});

test("flowers never crowd each other (Poisson-disc spacing)", () => {
  const flowers = plan("11-28", SONG_A, "dreamy").brushes.filter((b) => b.k === "flower") as Extract<Brush, { k: "flower" }>[];
  assert.ok(flowers.length > 10);
  for (let i = 0; i < flowers.length; i++)
    for (let j = i + 1; j < flowers.length; j++) assert.ok(Math.hypot(flowers[i].x - flowers[j].x, flowers[i].y - flowers[j].y) > 0.09 - 0.002);
});
