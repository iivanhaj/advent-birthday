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
const chrome = spawn(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
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
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
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
async function record(name, { path, w = 960, h = 640, wait = 6000, seconds = 5, clip, scale = 0.75, minFrameMs = 0, setup, script }) {
  if (ONLY && !ONLY.includes(name)) return;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: BASE + path });
  await sleep(wait);
  if (setup) await setup();
  const area = clip ? await clip() : { x: 0, y: 0, width: w, height: h };
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

ws.close();
chrome.kill();
console.log(`Saved to ${OUT}`);
process.exit(0);
