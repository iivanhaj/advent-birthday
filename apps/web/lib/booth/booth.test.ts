import { test } from "node:test";
import assert from "node:assert/strict";
import { INK, PAPER, develop, inkAmount, sobel, luma } from "./film.ts";
import { POSES, STRIP, STAMP_RADIUS, boothSky, caption, photoSlots, pressOrLift, stripFileName, type Stamp } from "./strip.ts";
import { NOTE_MAX, RATE, checkNote, mayPost, mergeNotes, tidy } from "./guestbook.ts";

/** A w × h RGBA image, black on the left half and white on the right. */
function halves(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.fill(x < w / 2 ? 0 : 255, (y * w + x) * 4, (y * w + x) * 4 + 3), (px[(y * w + x) * 4 + 3] = 255);
  return px;
}
const at = (px: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(px.slice((y * w + x) * 4, (y * w + x) * 4 + 3));

test("sobel finds a vertical edge and nothing on flat ground", () => {
  const w = 8, h = 6, img = halves(w, h);
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = luma(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
  assert.equal(sobel(lum, w, h, 1, 2), 0); // all black around it
  assert.equal(sobel(lum, w, h, 6, 2), 0); // all white around it
  assert.ok(sobel(lum, w, h, 3, 2) > 500); // right beside the edge: 4 × 255 × ~0.99
  assert.equal(sobel(lum, w, h, 0, 2), 0); // the border is left as paper
});

test("fine-line ink draws the edge in ink and leaves the rest as paper", () => {
  const w = 8, h = 6;
  const out = develop(halves(w, h), w, h, "ink");
  assert.deepEqual(at(out, w, 1, 2), PAPER);
  assert.deepEqual(at(out, w, 6, 2), PAPER);
  assert.deepEqual(at(out, w, 3, 2), INK);
  assert.deepEqual(at(out, w, 4, 2), INK);
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], 255);
});

test("the hint of colour keeps a little of the photo under the ink", () => {
  const w = 4, h = 4, red = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) red.set([255, 0, 0, 255], i * 4);
  const out = develop(red, w, h, "tint");
  // flat red, no edges: 80% paper + 20% red
  assert.deepEqual(at(out, w, 1, 1), [Math.round(PAPER[0] * 0.8 + 51), Math.round(PAPER[1] * 0.8), Math.round(PAPER[2] * 0.8)]);
});

test("the rose print is bare paper in the highlights and solid ink in the shadows", () => {
  assert.equal(inkAmount("rose", 0, 255, 0, 0), 0);
  assert.equal(inkAmount("rose", 0, 0, 0, 0), 1);
  assert.ok(inkAmount("rose", 0, 100, 0, 0) > inkAmount("rose", 0, 180, 0, 0));
});

test("pencil hatches only the shadows, on diagonals", () => {
  assert.equal(inkAmount("pencil", 0, 50, 5, 0), 0.35);
  assert.equal(inkAmount("pencil", 0, 50, 5, 1), 0);
  assert.equal(inkAmount("pencil", 0, 200, 5, 0), 0);
});

test("the strip is exactly 2 × 6 inches at 300 dpi, with four 4:3 photos that fit and don't overlap", () => {
  assert.deepEqual(STRIP, { w: 600, h: 1800 });
  const slots = photoSlots();
  assert.equal(slots.length, POSES);
  for (const [i, s] of slots.entries()) {
    assert.equal(s.w / s.h, 4 / 3);
    assert.ok(s.x > 20 && s.x + s.w < STRIP.w - 20);
    if (i) assert.ok(s.y > slots[i - 1].y + slots[i - 1].h);
  }
  // room left at the bottom for the title and caption
  const last = slots[slots.length - 1];
  assert.ok(STRIP.h - (last.y + last.h) > 120);
});

test("the booth's sky comes from the real one: twilight is golden hour, rain wins", () => {
  assert.equal(boothSky("day", false), "day");
  assert.equal(boothSky("dawn", false), "golden");
  assert.equal(boothSky("dusk", false), "golden");
  assert.equal(boothSky("night", false), "night");
  assert.equal(boothSky("night", true), "rain");
});

test("the caption is in Bangalore time, whatever the server's time zone", () => {
  const t = new Date("2026-11-23T14:10:00Z"); // 19:40 IST
  assert.equal(caption(t, "night", 21), "BANGALORE · 23 NOV 2026 · 19:40 · NIGHT 21°");
  assert.equal(caption(t, "golden", null), "BANGALORE · 23 NOV 2026 · 19:40 · GOLDEN HOUR");
  assert.equal(stripFileName(t), "birthday-four-poses-2026-11-23-1940.png");
});

test("clicking the strip presses a stamp, and clicking it again lifts it", () => {
  let s: Stamp[] = [];
  s = pressOrLift(s, "heart", 100, 100);
  s = pressOrLift(s, "star", 300, 300);
  assert.equal(s.length, 2);
  s = pressOrLift(s, "moon", 105, 98); // on the heart: lift it
  assert.deepEqual(s, [{ kind: "star", x: 300, y: 300 }]);
  s = pressOrLift(s, "date", 0, 5000); // off the paper: kept on it
  assert.deepEqual(s[1], { kind: "date", x: STAMP_RADIUS, y: STRIP.h - STAMP_RADIUS });
});

test("guestbook notes are tidied and checked", () => {
  assert.equal(tidy("  hello​\n\n  there "), "hello there");
  assert.deepEqual(checkNote("  Happy birthday! ", ""), { ok: true, message: "Happy birthday!", name: "a guest" });
  assert.deepEqual(checkNote("Push it to the sky", "Sam"), { ok: true, message: "Push it to the sky", name: "Sam" });
  assert.equal(checkNote("x", "Sam").ok, false);
  assert.equal(checkNote("a".repeat(NOTE_MAX + 1), "Sam").ok, false);
  assert.equal(checkNote("visit www.example.com", "Sam").ok, false);
  assert.equal(checkNote("you are sh1t", "Sam").ok, false);
  assert.equal(checkNote("s.h.i.t", "Sam").ok, false);
  assert.equal(checkNote(42, "Sam").ok, false);
});

test("the rate limit allows a few notes, then asks you to wait", () => {
  const now = 1_000_000_000;
  assert.deepEqual(mayPost([], now), { ok: true });
  assert.deepEqual(mayPost([now - 5_000], now), { ok: false, retryInMs: RATE.gapMs - 5_000 });
  const three = [now - 9 * 60_000, now - 5 * 60_000, now - 60_000];
  assert.deepEqual(mayPost(three, now), { ok: false, retryInMs: 60_000 });
  assert.deepEqual(mayPost(three, now + 60_000), { ok: true }); // the oldest has left the window
});

test("guestbook updates merge newest first without duplicates", () => {
  const n = (id: number, t: string) => ({ id, message: "hi", name: "a", created_at: t });
  const merged = mergeNotes([n(1, "2026-11-23T10:00:00Z"), n(2, "2026-11-23T11:00:00Z")], [n(2, "2026-11-23T11:00:00Z"), n(3, "2026-11-23T12:00:00Z")]);
  assert.deepEqual(merged.map((x) => x.id), [3, 2, 1]);
  assert.equal(mergeNotes([], [n(1, "a"), n(2, "b"), n(3, "c")], 2).length, 2);
});
