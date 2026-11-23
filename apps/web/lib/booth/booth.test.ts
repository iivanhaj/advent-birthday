import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSIC, EXPOSURE, FILMS, INK, PAPER, blur, develop, exposureGain, gaussian, shade } from "./film.ts";
import { POSES, STRIP, STAMP_RADIUS, boothSky, caption, photoSlots, pressOrLift, stripFileName, type Stamp } from "./strip.ts";
import { NOTE_MAX, RATE, checkNote, mayPost, mergeNotes, tidy } from "./guestbook.ts";

const to255 = (c: number[]) => c.map((v) => Math.round(v * 255));
const near = (a: number[], b: number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const gray = (w: number, h: number, v: number) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set([v, v, v, 255], i * 4);
  return px;
};

test("a Gaussian kernel sums to 1, and blurring a flat image changes nothing", () => {
  for (const s of [0.5, 1, 1.6, 4]) assert.ok(Math.abs(gaussian(s).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const flat = new Float32Array(30 * 20).fill(0.4);
  for (const v of blur(flat, 30, 20, 2)) assert.ok(Math.abs(v - 0.4) < 1e-6);
});

test("exposure lifts a dim frame and calms a bright one, within limits", () => {
  assert.equal(exposureGain(EXPOSURE.target), 1);
  assert.ok(exposureGain(0.3) > 1);
  assert.ok(exposureGain(0.8) < 1);
  assert.equal(exposureGain(0.01), EXPOSURE.max);
  assert.equal(exposureGain(1), EXPOSURE.min);
});

test("a dim room and a bright one print alike", () => {
  const dim = develop(gray(16, 12, 60), 16, 12, "rose");
  const bright = develop(gray(16, 12, 130), 16, 12, "rose");
  assert.ok(near(Array.from(dim.slice(0, 3)), Array.from(bright.slice(0, 3)), 3));
});

test("rose print: highlights are bare paper, shadows solid rose ink", () => {
  for (const [x, y] of [[10, 10], [300, 200], [639, 479]]) {
    assert.deepEqual(to255(shade("rose", 1, x, y)), to255(PAPER));
    assert.deepEqual(to255(shade("rose", 0, x, y)), to255(INK));
  }
  // darker always means more ink (on the green channel, ink is far darker than paper)
  assert.ok(shade("rose", 0.3, 5, 5)[1] < shade("rose", 0.6, 5, 5)[1]);
});

test("classic booth is black and white, with darker corners", () => {
  for (const v of [0.2, 0.5, 0.8]) {
    const [r, g, b] = shade("classic", v, 320, 240);
    assert.ok(r >= g && g >= b && r - b < 0.07, "a warm neutral, no colour cast");
  }
  // same brightness, centre versus corner (averaged over a patch, so grain cancels out)
  const patch = (x0: number, y0: number) => {
    let s = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) s += shade("classic", 0.7, x0 + x, y0 + y)[1];
    return s / 64;
  };
  assert.ok(patch(316, 236) - patch(0, 0) > CLASSIC.vignette * 0.3);
});

test("both films keep their colours in range, for any brightness", () => {
  for (const { id } of FILMS)
    for (let i = 0; i <= 100; i++) for (const c of shade(id, i / 100, (i * 37) % 640, (i * 53) % 480)) assert.ok(c >= 0 && c <= 1, `${id} gave ${c}`);
});

test("the CPU darkroom returns an opaque image of the same size", () => {
  const out = develop(gray(20, 10, 128), 20, 10, "classic", 2);
  assert.equal(out.length, 20 * 10 * 4);
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], 255);
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
