#!/usr/bin/env node
/**
 * Retina screenshots for the README.
 *
 *   pnpm dev            # in one terminal
 *   pnpm screenshots    # in another → docs/screenshots/*.png
 *
 * Drives an installed Chrome or Edge in headless mode over the DevTools
 * protocol (Node 22's built-in WebSocket, so no dependencies). Unlike
 * `chrome --screenshot`, it waits in real time, so every draw-in, shutter and
 * lamp animation has finished before the shot.
 *
 * Needs DEV_UNLOCK_ALL=true in apps/web/.env.local (the ?preview= and ?sky=
 * switches only work then). Options:
 *   BASE_URL=http://localhost:3000   site to shoot
 *   CHROME=/path/to/chrome           override browser detection
 *   ONLY=day,phone                   shoot a subset
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PORT = 9333;
const ONLY = process.env.ONLY?.split(",").map((s) => s.trim());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- find a browser ----
const CANDIDATES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error("No Chrome/Edge found. Set CHROME=/path/to/chrome.");
  process.exit(1);
}

// ---- is the site up? ----
try {
  await fetch(BASE);
} catch {
  console.error(`Nothing at ${BASE}. Start it first with: pnpm dev`);
  process.exit(1);
}

// ---- launch headless with a throwaway profile ----
const profile = mkdtempSync(join(tmpdir(), "advent-shots-"));
const chrome = spawn(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const cleanup = () => {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* the browser may still hold a file briefly; the OS temp cleaner gets it */
  }
};

let page;
for (let i = 0; i < 60 && !page; i++) {
  try {
    page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  } catch {
    /* not up yet */
  }
  if (!page) await sleep(250);
}
if (!page) {
  console.error("Couldn't connect to the headless browser.");
  cleanup();
  process.exit(1);
}

// ---- tiny DevTools protocol client ----
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
mkdirSync(OUT, { recursive: true });

async function shot(name, path, { w = 1280, h = 860, dpr = 2, mobile = false, wait = 7000, before } = {}) {
  if (ONLY && !ONLY.includes(name)) return;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile });
  await send("Page.navigate", { url: BASE + path });
  await sleep(wait); // the façade draws in, shutters swing, lamps flick on
  if (before) await before();
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(result.data, "base64"));
  console.log(`✓ ${name}.png  (${w}×${h} @${dpr}x)`);
}

/** Move the virtual mouse over a window so its kraft tag shows. */
async function hoverWindow(n) {
  const r = await evaluate(
    `(() => { const b = document.querySelector('button[aria-label^="Window ${n},"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
  if (r) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
  // Focus shows the same card, and is reliable where a synthetic hover may not be.
  await evaluate(`document.querySelector('button[aria-label^="Window ${n},"]')?.focus({ focusVisible: false })`);
  await sleep(1200);
}

// ---- the shots used in the README ----
await shot("day", "/?preview=mixed&sky=day", { before: () => hoverWindow(5) });
await shot("night", "/?preview=mixed&sky=night");
await shot("finale", "/?preview=finale&sky=dusk", { wait: 7600 }); // timed so fireworks are mid-burst
await shot("zoom", "/?preview=mixed&sky=day", {
  before: async () => {
    await evaluate(`document.querySelector('button[aria-label^="Zoom in"]')?.click()`);
    await sleep(400);
    await evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))`);
    await sleep(2500);
  },
});
// Door 1's greenhouse, with the card for one flower showing
await shot("greenhouse", "/door/1?preview=mixed", {
  h: 1000,
  wait: 6000,
  before: async () => {
    const r = await evaluate(
      `(() => { const el = [...document.querySelectorAll('.md\\\\:block rect.cursor-pointer')][4]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`,
    );
    if (r) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
    await sleep(1000);
  },
});
// Door 2: Mochi's home, with her route overlay on
await shot("mochi", "/door/2?preview=mixed", {
  h: 1000,
  wait: 6000,
  before: async () => {
    await evaluate(`dispatchEvent(new CustomEvent('mochi:debug', { detail: true }))`);
    await sleep(2500);
  },
});
// Door 3: birthday records, with one on the turntable
await shot("records", "/door/3?theme=dreamy", {
  h: 1000,
  wait: 8000,
  before: async () => {
    await evaluate(`document.querySelector('button[aria-label^="Sure Thing"]')?.click()`);
    await sleep(2500);
  },
});
await shot("phone", "/?preview=mixed&sky=night", {
  w: 390,
  h: 844,
  dpr: 3,
  mobile: true,
  before: async () => {
    await evaluate(`document.querySelector('button[aria-label="See the whole building"]')?.click()`);
    await sleep(2500);
  },
});

ws.close();
cleanup();
console.log(`Saved to ${OUT}`);
process.exit(0);
