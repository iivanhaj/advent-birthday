#!/usr/bin/env node
/**
 * Animated GIFs for the README.
 *
 *   pnpm dev            # in one terminal
 *   pnpm animations     # in another → docs/animations/*.gif
 *
 * Drives headless Chrome over the DevTools protocol (like screenshots.mjs),
 * grabs frames in real time while a little script plays with the page, and
 * encodes them with the dependency-free encoder in gif.mjs.
 * Needs DEV_UNLOCK_ALL=true in apps/web/.env.local. ONLY=windows,mochi,records shoots a subset.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodeGif } from "./gif.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "animations");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ONLY = process.env.ONLY?.split(",").map((s) => s.trim());
const PORT = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!browser) throw new Error("No Chrome/Edge found. Set CHROME=/path/to/chrome.");

const profile = mkdtempSync(join(tmpdir(), "advent-anim-"));
const chrome = spawn(browser, ["--headless=new", "--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=d3d11", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let page;
for (let i = 0; i < 60 && !page; i++) {
  try {
    page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  } catch {
    /* not up yet */
  }
  if (!page) await sleep(250);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method) listeners.forEach((l) => l(m));
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++nextId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const rect = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
await send("Page.enable");
await send("Runtime.enable");
mkdirSync(OUT, { recursive: true });

/**
 * Record `seconds` of the page (optionally a clip of it) while `script` runs.
 * Frames are grabbed as fast as Chrome hands them over (~10–15 fps); each
 * frame's delay is the real time until the next one, so playback speed is true.
 */
/** Crop a decoded frame to `r` (frame pixels) and resize it by `scale` with bilinear sampling. */
function cropScale({ width, rgba }, r, scale) {
  const ow = Math.round(r.width * scale);
  const oh = Math.round(r.height * scale);
  const out = new Uint8Array(ow * oh * 4);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const sx = r.x + (x + 0.5) / scale - 0.5;
      const sy = r.y + (y + 0.5) / scale - 0.5;
      const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy));
      const fx = sx - x0, fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const p = (yy, xx) => rgba[(yy * width + xx) * 4 + c];
        const v = p(y0, x0) * (1 - fx) * (1 - fy) + p(y0, x0 + 1) * fx * (1 - fy) + p(y0 + 1, x0) * (1 - fx) * fy + p(y0 + 1, x0 + 1) * fx * fy;
        out[(y * ow + x) * 4 + c] = v;
      }
      out[(y * ow + x) * 4 + 3] = 255;
    }
  return { width: ow, height: oh, rgba: out };
}

/**
 * Screencast recording: Chrome streams frames as it paints them (much faster
 * than one screenshot at a time, which matters for GPU canvases); we crop
 * and scale each frame ourselves.
 */
async function cast(name, { path, w = 1280, h = 900, wait = 6000, seconds = 6, clip, scale = 0.6, minFrameMs = 80, setup, script }) {
  if (ONLY && !ONLY.includes(name)) return;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: BASE + path });
  await sleep(wait);
  if (setup) await setup();
  const area = clip ? await clip() : { x: 0, y: 0, width: w, height: h }; // viewport coordinates
  const shots = [];
  let kept = 0;
  const on = (m) => {
    if (m.method !== "Page.screencastFrame") return;
    send("Page.screencastFrameAck", { sessionId: m.params.sessionId });
    const at = Date.now();
    if (at - kept < minFrameMs) return;
    kept = at;
    shots.push({ png: Buffer.from(m.params.data, "base64"), at });
  };
  listeners.add(on);
  await send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  const run = script ? script() : Promise.resolve();
  await sleep(seconds * 1000);
  await send("Page.stopScreencast");
  listeners.delete(on);
  await run;
  const frames = shots.map((f, i) => {
    const d = decodePng(f.png);
    const k = d.width / w; // frame pixels per CSS pixel
    return { ...cropScale(d, { x: area.x * k, y: area.y * k, width: area.width * k, height: area.height * k }, scale / k), delayMs: (shots[i + 1]?.at ?? f.at + 80) - f.at };
  });
  const gif = encodeGif(frames, frames[0].width, frames[0].height);
  writeFileSync(join(OUT, `${name}.gif`), gif);
  console.log(`✓ ${name}.gif  ${frames[0].width}×${frames[0].height}, ${frames.length} frames, ${(gif.length / 1e6).toFixed(2)} MB`);
}

async function record(name, { path, w = 960, h = 640, wait = 6000, seconds = 5, clip, scale = 0.75, minFrameMs = 0, setup, script }) {
  if (ONLY && !ONLY.includes(name)) return;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: BASE + path });
  await sleep(wait);
  if (setup) await setup();
  const area = clip ? await clip() : { x: 0, y: 0, width: w, height: h };
  // screenshot clips are in page coordinates; rects from the page are relative to the scrolled viewport
  const scroll = await js(`({ x: scrollX, y: scrollY })`);
  area.x += scroll.x;
  area.y += scroll.y;
  const frames = [];
  const t0 = Date.now();
  const run = script ? script() : Promise.resolve();
  while (Date.now() - t0 < seconds * 1000) {
    const at = Date.now();
    const { result } = await send("Page.captureScreenshot", { format: "png", clip: { ...area, scale } });
    frames.push({ png: Buffer.from(result.data, "base64"), at });
    const left = minFrameMs - (Date.now() - at);
    if (left > 0) await sleep(left); // fewer frames for busy scenes keeps the file small
  }
  await run;
  const decoded = frames.map((f, i) => ({ ...decodePng(f.png), delayMs: (frames[i + 1]?.at ?? f.at + 80) - f.at }));
  const { width, height } = decoded[0];
  const gif = encodeGif(decoded, width, height);
  writeFileSync(join(OUT, `${name}.gif`), gif);
  console.log(`✓ ${name}.gif  ${width}×${height}, ${frames.length} frames, ${(gif.length / 1e6).toFixed(2)} MB`);
}

const hover = async (sel) => {
  const r = await rect(sel);
  if (r) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x + r.w / 2, y: r.y + r.h / 2 });
};
const click = async (sel) => {
  const r = await rect(sel);
  if (!r) return;
  const at = { x: r.x + r.w / 2, y: r.y + r.h / 2, button: "left", clickCount: 1 };
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...at });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at });
};

// Recorded at a normal desktop size and scaled down, so pages look the way they really do.

// 1. Peek into windows, then fly through one into its page.
await record("windows", {
  path: "/?preview=mixed&sky=day",
  w: 1280,
  h: 860,
  scale: 0.56,
  seconds: 7,
  script: async () => {
    await sleep(400);
    await hover('button[aria-label^="Window 7,"]');
    await sleep(1200);
    await hover('button[aria-label^="Window 3,"]');
    await sleep(1500);
    await click('button[aria-label^="Window 3,"]');
  },
});

// 2. Mochi on the building: treats drop and she climbs and jumps to reach them.
//    Cropped around the building so she's big enough to see.
await record("mochi", {
  path: "/?preview=mixed&sky=day",
  w: 1280,
  h: 860,
  seconds: 10,
  scale: 0.8,
  // the crop would slice the page title in half, so hide it for this clip
  setup: () => js(`document.querySelector('header').style.visibility = 'hidden'`),
  clip: async () => {
    const b = await rect('[class*="aspect-[2/3]"]');
    const x = Math.max(0, b.x - 190);
    const y = Math.max(0, b.y - 70);
    return { x, y, width: Math.min(1280 - x, b.w + 380), height: 860 - y };
  },
  script: async () => {
    await sleep(300);
    await js(`dispatchEvent(new Event('mochi:treat'))`);
    await sleep(4200);
    await js(`dispatchEvent(new Event('mochi:treat'))`);
  },
});

// 3. Records: drop one on the turntable, then switch paint themes while it spins.
//    The window is tall enough that the whole turntable card is on screen.
await record("records", {
  path: "/door/3?demo=1",
  w: 1280,
  h: 1200,
  seconds: 7.5,
  clip: async () => {
    const r = await rect('section[aria-label="Turntable"]');
    return { x: r.x - 12, y: r.y - 12, width: r.w + 24, height: r.h + 24 };
  },
  scale: 0.8,
  minFrameMs: 100,
  script: async () => {
    await sleep(200);
    await js(`document.querySelector('button[aria-label^="Sure Thing"]')?.click()`);
    await sleep(3000);
    await js(`[...document.querySelectorAll('[role=radio]')].find(b => b.textContent.includes('Meadow'))?.click()`);
    await sleep(1900);
    await js(`[...document.querySelectorAll('[role=radio]')].find(b => b.textContent.includes('Painted'))?.click()`);
  },
});

// 4. The commit pond: ripples, then the three looks (garden → ink → lanterns).
await cast("pond", {
  path: "/door/4?preview=mixed&sky=day",
  w: 1280,
  h: 900,
  seconds: 8,
  scale: 0.62,
  minFrameMs: 90,
  setup: async () => {
    await js(`(() => { const s = document.querySelector('section[aria-label="The pond"]'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 10); })()`);
    await sleep(600);
  },
  clip: async () => {
    const r = await rect('canvas[role=img]');
    return { x: r.x, y: r.y, width: r.w, height: r.h };
  },
  script: async () => {
    const ripple = (u, v) => js(`(() => { const c = document.querySelector('canvas[role=img]'); const b = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown', { clientX: b.left + b.width * ${u}, clientY: b.top + b.height * ${v}, bubbles: true })); })()`);
    await sleep(300);
    await ripple(0.35, 0.45);
    await sleep(700);
    await ripple(0.65, 0.6);
    await sleep(2000);
    await js(`[...document.querySelectorAll('[role=radio]')].find(b => b.textContent.startsWith('Ink'))?.click()`);
    await sleep(500);
    await ripple(0.5, 0.4);
    await sleep(2000);
    await js(`[...document.querySelectorAll('[role=radio]')].find(b => b.textContent.startsWith('Night'))?.click()`);
  },
});

// 5. The stress test: 10,000 koi on the GPU.
await cast("stress", {
  path: "/door/4?preview=mixed&sky=day",
  w: 1280,
  h: 1000,
  seconds: 6,
  scale: 0.5,
  minFrameMs: 140,
  setup: async () => {
    await js(`(() => { const s = document.querySelector('section[aria-label="Stress test"]'); s.scrollIntoView(); s.querySelectorAll('button')[0].click(); })()`);
    await sleep(2500);
  },
  clip: async () => {
    const r = await rect('section[aria-label="Stress test"] .relative.mt-3');
    return { x: r.x, y: r.y, width: r.w, height: r.h };
  },
});

// 6. The infinite bloom: zooming in, ink, then glass.
await cast("bloom", {
  path: "/door/5?sky=day",
  w: 1280,
  h: 900,
  seconds: 9,
  scale: 0.55,
  minFrameMs: 70,
  setup: async () => {
    await js(`(() => { const s = document.querySelector('section[aria-label="The bloom"]'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 10); const c = document.querySelector('canvas[role=img]'); for (let i = 0; i < 4; i++) c.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true })); })()`);
    await sleep(600);
  },
  clip: async () => {
    const r = await rect('canvas[role=img]');
    return { x: r.x, y: r.y, width: r.w, height: r.h };
  },
  script: async () => {
    await sleep(5000);
    await js(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Glass at night')?.click()`);
  },
});

// 7. The photo booth: the room at golden hour, behind the curtain, four poses, the strip and its stamps.
await cast("booth", {
  path: "/door/6?sky=dusk",
  w: 1280,
  h: 1000,
  seconds: 19,
  scale: 0.5,
  minFrameMs: 110,
  setup: async () => {
    await js(`(() => { const s = document.querySelector('section[aria-label="The photo booth"]'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 10); })()`);
    await sleep(600);
  },
  clip: async () => {
    const r = await rect('section[aria-label="The photo booth"]');
    return { x: r.x, y: r.y, width: r.w, height: Math.min(830, 1000 - r.y) }; // tall enough for the developing strip
  },
  script: async () => {
    const button = (text) => js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
    await sleep(1800);
    await button("Step behind the curtain");
    await sleep(1600);
    await button("Garden vine");
    await sleep(500);
    await button("begin");
    await sleep(11500);
    const stamp = (i, u, v) =>
      js(`document.querySelectorAll('[aria-label$=" stamp"]')[${i}].click()`).then(() => sleep(150)).then(() => js(`(() => { const c = document.querySelector('canvas.booth-develop'); const b = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown', { clientX: b.left + b.width * ${u}, clientY: b.top + b.height * ${v}, bubbles: true })); })()`));
    await stamp(0, 0.78, 0.2);
    await sleep(500);
    await stamp(4, 0.25, 0.68);
  },
});

// 8. The firefly carousel: turn it, change the mood, then play a song while it spins.
await cast("carousel", {
  path: "/door/7",
  w: 1280,
  h: 1000,
  seconds: 14,
  scale: 0.5,
  minFrameMs: 100,
  setup: async () => {
    await js(`(() => { const s = document.querySelector('section[aria-label="The firefly carousel"]'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 10); })()`);
    await sleep(2500);
  },
  clip: async () => {
    const r = await rect('section[aria-label="The firefly carousel"]');
    const b = await rect('button[aria-label="Turn the carousel right"]');
    return { x: r.x, y: r.y, width: r.w, height: b.y + b.h + 24 - r.y }; // down to the buttons, not the Spotify player
  },
  script: async () => {
    const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.click()`);
    const button = (text) => js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
    await sleep(1200);
    await click('button[aria-label="Turn the carousel right"]');
    await sleep(1400);
    await click('button[aria-label="Turn the carousel right"]');
    await sleep(1600);
    await button("bright and bouncy");
    await sleep(3000);
    await button("Play");
  },
});

// 9. The holographic card: the foil catching the light, a new birthday, then the card turned over.
await cast("card", {
  path: "/door/8",
  w: 1280,
  h: 960,
  seconds: 13,
  scale: 0.5,
  minFrameMs: 100,
  setup: async () => {
    await js(`(() => { const s = document.querySelector('section[aria-label="The holographic card"]'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 10); })()`);
    await sleep(1500);
  },
  clip: async () => {
    const r = await rect('section[aria-label="The holographic card"]');
    return { x: r.x, y: r.y, width: r.w, height: Math.min(r.h, 960 - r.y) };
  },
  script: async () => {
    // sweep the "mouse" across the card so the foil and glare move
    const sweep = async (from, to, ms) => {
      const steps = Math.round(ms / 60);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = from[0] + (to[0] - from[0]) * t, y = from[1] + (to[1] - from[1]) * t;
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await sleep(60);
      }
    };
    const c = await rect(".holo-size");
    await sweep([c.x, c.y + c.h * 0.3], [c.x + c.w, c.y + c.h * 0.6], 2600);
    await js(`(() => { const i = document.getElementById('card-birthday'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '1999-05-14'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sweep([c.x + c.w, c.y + c.h * 0.6], [c.x, c.y + c.h * 0.4], 2600);
    await js(`document.querySelector('.holo-card').click()`);
    await sleep(2200);
    await js(`document.querySelector('.holo-card').click()`);
  },
});

ws.close();
chrome.kill();
console.log(`Saved to ${OUT}`);
process.exit(0);
