/**
 * Door 3 · birthday records. Every song gets its own painted record, seeded by
 * the birthday mixed with the song's Spotify ID.
 *
 * Painting is split in two:
 *   plan(birthday, trackId, theme) → a list of brush instructions (pure data,
 *     in "record units": the disc has radius 1, centred on 0,0)
 *   render(ctx, plan, size) → paints those instructions on a canvas
 *
 * The plan is deterministic (same birthday + song + theme → the same list,
 * on every device) and fully unit-tested; the renderer is a thin loop.
 * The birthday is only ever the month and day ("11-28"): no year, so nobody's
 * age is in a seed or a URL.
 */

export type Theme = "dreamy" | "meadow" | "vinyl";
export const THEMES: { id: Theme; label: string; blurb: string }[] = [
  { id: "dreamy", label: "Dreamy", blurb: "flowing paint, dotted rings, glitter" },
  { id: "meadow", label: "Meadow", blurb: "vines and tiny inked flowers" },
  { id: "vinyl", label: "Painted vinyl", blurb: "black vinyl, painted band, printed label" },
];

export type Brush =
  | { k: "fill"; c0: string; c1: string }
  | { k: "blob"; x: number; y: number; r: number; col: string; seed: number; layers: number }
  | { k: "swirl"; r: number; a0: number; len: number; w: number; col: string }
  | { k: "dots"; r: number; a0: number; span: number; col: string; size: number; gap: number; wob: number }
  | { k: "vine"; r: number; phase: number; col: string }
  | { k: "leaf"; x: number; y: number; rot: number; col: string; len: number }
  | { k: "flower"; x: number; y: number; s: number; rot: number; fill: string; ink: boolean }
  | { k: "glitter"; x: number; y: number; s: number; a: number }
  | { k: "grooves"; from: number; step: number; col: string }
  | { k: "clip"; r0: number; r1: number }
  | { k: "unclip" }
  | { k: "label"; title: string; sub: string; c0: string; c1: string }
  | { k: "sheen"; a: number }
  | { k: "hub"; clear: boolean };

export type Plan = { seed: number; theme: Theme; hue: number; brushes: Brush[] };

// ---------- seeded randomness ----------

/** FNV-1a: a tiny, well-spread string hash. Same text → same 32-bit seed, everywhere. */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a fast 32-bit PRNG. Integer-only maths, so every JS engine gives identical numbers. */
export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughly normal noise (sum of four uniforms): natural-looking wobble. */
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) / 1.15;

/** "11-28" from "2026-11-28", "11-28" or "28/11"-ish input. Null if it isn't a real day. */
export function monthDay(input: string): string | null {
  const m = input.match(/^(?:\d{4}-)?(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mm < 1 || mm > 12 || dd < 1 || dd > days[mm - 1]) return null;
  return `${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** The birthday-and-song mix: one seed per record. */
export const recordSeed = (birthday: string, trackId: string) => hashString(`${birthday}:${trackId}`);

// ---------- colour ----------

const r2 = (n: number) => Math.round(n * 1000) / 1000;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${Math.round(((h % 360) + 360) % 360)},${Math.round(s)}%,${Math.round(l)}%,${r2(a)})`;
export const INK = "#9E3B4C";
const CREAM = "#FFF6E0";

/**
 * Each song's palette: a main hue, an analogous neighbour (+45°) and a
 * contrasting accent (+150–210°), all kept soft (pastel lightness), so every
 * record is clearly different but they still sit together in the crate.
 */
function palette(r: () => number) {
  const h = r() * 360;
  return { h, near: h + 45, far: h + 150 + r() * 60 };
}

// ---------- the plans ----------

export function plan(birthday: string, trackId: string, theme: Theme): Plan {
  const seed = recordSeed(birthday, trackId);
  const r = mulberry32(seed);
  const { h, near, far } = palette(r);
  const b: Brush[] = [];
  const polar = (a: number, rr: number) => ({ x: r2(Math.cos(a) * rr), y: r2(Math.sin(a) * rr) });
  const blob = (rMin: number, rMax: number, size: number, col: string, layers = 18) => {
    const p = polar(r() * Math.PI * 2, rMin + r() * (rMax - rMin));
    b.push({ k: "blob", ...p, r: r2(size), col, seed: Math.floor(r() * 2 ** 31), layers });
  };
  /** Points spread evenly with no two closer than `gap` (dart-throwing Poisson-disc sampling). */
  const scatter = (count: number, rMin: number, rMax: number, gap: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let t = 0; t < count * 60 && pts.length < count; t++) {
      const p = polar(r() * Math.PI * 2, rMin + Math.sqrt(r()) * (rMax - rMin));
      if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > gap)) pts.push(p);
    }
    return pts;
  };

  if (theme === "dreamy") {
    b.push({ k: "fill", c0: hsl(h, 55, 88), c1: hsl(h, 50, 74) });
    for (let i = 0; i < 14; i++) blob(0.4, 0.95, 0.2 + r() * 0.2, hsl([h, near, far][i % 3] + gauss(r) * 10, 60, 70, 0.05));
    for (let i = 0; i < 140; i++)
      b.push({ k: "swirl", r: r2(0.36 + r() * 0.62), a0: r2(r() * Math.PI * 2), len: r2(0.2 + r() * 0.9), w: r2(0.008 + r() * 0.024), col: hsl([h, near, far, h][i % 4] + gauss(r) * 12, 55 + r() * 20, 60 + r() * 25, 0.22 + r() * 0.3) });
    for (let i = 0; i < 8; i++)
      b.push({ k: "dots", r: r2(0.4 + r() * 0.56), a0: r2(r() * Math.PI * 2), span: r2(Math.PI * (0.6 + r() * 1.3)), col: [hsl(near, 80, 80), CREAM, hsl(far, 70, 82)][i % 3], size: 0.011, gap: 0.026, wob: 0.02 });
    for (const p of scatter(26, 0.42, 0.97, 0.09)) b.push({ k: "flower", ...p, s: r2(0.03 + r() * 0.035), rot: r2(r() * 6.28), fill: [hsl(far, 70, 80), CREAM, hsl(h + 330, 65, 66)][Math.floor(r() * 3)], ink: false });
    for (let i = 0; i < 420; i++) b.push({ k: "glitter", ...polar(r() * Math.PI * 2, 0.36 + r() * 0.64), s: r2(0.003 + r() * 0.006), a: r2(0.3 + r() * 0.7) });
    b.push({ k: "grooves", from: 0.36, step: 0.012, col: "rgba(255,255,255,0.08)" }, { k: "sheen", a: 0.28 }, { k: "hub", clear: true });
  }

  if (theme === "meadow") {
    b.push({ k: "fill", c0: hsl(h, 40, 92), c1: hsl(h, 40, 89) });
    for (let i = 0; i < 10; i++) blob(0.4, 0.95, 0.22 + r() * 0.18, hsl([h, near][i % 2], 45, 78, 0.04));
    for (let ring = 0; ring < 4; ring++) {
      const rad = 0.45 + ring * 0.15;
      const phase = r2(ring + r());
      b.push({ k: "vine", r: rad, phase, col: "#6F9F6B" });
      const at = (a: number) => rad + Math.sin(a * 6 + phase) * 0.03;
      for (let a = r() * 0.3; a < Math.PI * 2; a += 0.18 + r() * 0.12)
        b.push({ k: "leaf", ...polar(a, at(a)), rot: r2(a + (r() < 0.5 ? 0.7 : -0.7)), col: hsl(110 + gauss(r) * 12, 35, 62), len: 0.025 });
      for (let a = r(); a < Math.PI * 2; a += 0.35 + r() * 0.3)
        b.push({ k: "flower", ...polar(a, at(a)), s: r2(0.028 + r() * 0.03), rot: r2(r() * 6.28), fill: [hsl(far, 65, 80), hsl(h + 330, 60, 72), CREAM, hsl(near, 70, 78)][Math.floor(r() * 4)], ink: true });
    }
    for (let i = 0; i < 5; i++) b.push({ k: "dots", r: r2(0.44 + i * 0.13), a0: 0, span: r2(Math.PI * 2), col: [INK, hsl(near, 60, 55)][i % 2], size: 0.008, gap: 0.032, wob: 0 });
    b.push({ k: "hub", clear: true });
  }

  if (theme === "vinyl") {
    b.push({ k: "fill", c0: "#1c1519", c1: "#1c1519" }, { k: "grooves", from: 0.36, step: 0.008, col: "rgba(255,255,255,0.05)" }, { k: "clip", r0: 0.66, r1: 1 });
    for (let i = 0; i < 10; i++) blob(0.72, 0.97, 0.14 + r() * 0.1, hsl([h, near, far][i % 3] + gauss(r) * 10, 60, 72, 0.08));
    for (let i = 0; i < 60; i++) b.push({ k: "swirl", r: r2(0.68 + r() * 0.3), a0: r2(r() * Math.PI * 2), len: r2(0.2 + r() * 0.8), w: r2(0.008 + r() * 0.016), col: hsl([h, near, far][i % 3], 60, 75, 0.35) });
    for (const p of scatter(14, 0.72, 0.96, 0.1)) b.push({ k: "flower", ...p, s: r2(0.03 + r() * 0.03), rot: r2(r() * 6.28), fill: [hsl(far, 70, 82), CREAM][Math.floor(r() * 2)], ink: false });
    b.push({ k: "unclip" }, { k: "label", title: "", sub: "", c0: hsl(h, 55, 85), c1: hsl(h, 50, 72) }, { k: "sheen", a: 0.18 });
  }

  return { seed, theme, hue: Math.round(h), brushes: b };
}

// ---------- rendering ----------

type Ctx = CanvasRenderingContext2D;

function deform(r: () => number, pts: number[][], depth: number, v: number) {
  let p = pts;
  for (let d = 0; d < depth; d++) {
    const q: number[][] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const c = p[(i + 1) % p.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      q.push(a, [(a[0] + c[0]) / 2 + gauss(r) * len * v * a[2], (a[1] + c[1]) / 2 + gauss(r) * len * v * a[2], a[2] * (0.85 + r() * 0.3)]);
    }
    p = q;
  }
  return p;
}

/**
 * Paint a plan onto `ctx`, filling a `size` × `size` square. Watercolour blobs
 * follow Tyler Hobbs' layering technique: deform a polygon recursively, then
 * stack many very transparent, slightly different copies so edges bleed.
 */
export function render(ctx: Ctx, p: Plan, size: number, text?: { title: string; sub: string }) {
  const R = size / 2 - 2;
  const at = (n: number) => n * R;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.clip();
  for (const b of p.brushes) {
    switch (b.k) {
      case "fill": {
        const g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R);
        g.addColorStop(0, b.c0);
        g.addColorStop(1, b.c1);
        ctx.fillStyle = g;
        ctx.fillRect(-R, -R, 2 * R, 2 * R);
        break;
      }
      case "blob": {
        const r = mulberry32(b.seed);
        const base: number[][] = [];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          base.push([at(b.x) + Math.cos(a) * at(b.r), at(b.y) + Math.sin(a) * at(b.r), 0.6 + r() * 0.8]);
        }
        const shape = deform(r, base, 2, 0.45);
        ctx.fillStyle = b.col;
        for (let l = 0; l < b.layers; l++) {
          const poly = deform(r, shape, 3, 0.35);
          ctx.beginPath();
          poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          ctx.fill();
        }
        break;
      }
      case "swirl": {
        ctx.strokeStyle = b.col;
        ctx.lineWidth = at(b.w);
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.03) {
          const a = b.a0 + t * b.len;
          const rr = at(b.r + Math.sin(a * 3) * 0.025 + Math.sin(a * 9 + b.r * 50) * 0.008);
          if (t === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.stroke();
        break;
      }
      case "dots": {
        ctx.fillStyle = b.col;
        for (let a = 0; a < b.span; a += b.gap / b.r) {
          const aa = b.a0 + a;
          const rr = at(b.r + Math.sin(aa * 3 + b.r * 50) * b.wob);
          ctx.beginPath();
          ctx.arc(Math.cos(aa) * rr, Math.sin(aa) * rr, at(b.size) / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "vine": {
        ctx.strokeStyle = b.col;
        ctx.lineWidth = Math.max(1, at(0.006));
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.02) {
          const rr = at(b.r + Math.sin(a * 6 + b.phase) * 0.03);
          if (a === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.stroke();
        break;
      }
      case "leaf": {
        ctx.save();
        ctx.translate(at(b.x), at(b.y));
        ctx.rotate(b.rot);
        ctx.fillStyle = b.col;
        ctx.beginPath();
        ctx.ellipse(0, -at(b.len), at(b.len) * 0.48, at(b.len), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "flower": {
        const s = at(b.s);
        ctx.save();
        ctx.translate(at(b.x), at(b.y));
        ctx.rotate(b.rot);
        ctx.fillStyle = b.fill;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(0.8, at(0.0045));
        for (let i = 0; i < 5; i++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath();
          ctx.ellipse(0, -s * 0.6, s * 0.33, s * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          if (b.ink) ctx.stroke();
        }
        ctx.fillStyle = "#F2C45A";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "glitter":
        ctx.fillStyle = `rgba(255,250,235,${b.a})`;
        ctx.beginPath();
        ctx.arc(at(b.x), at(b.y), Math.max(0.5, at(b.s) / 2), 0, Math.PI * 2);
        ctx.fill();
        break;
      case "grooves":
        ctx.strokeStyle = b.col;
        ctx.lineWidth = 1;
        for (let q = b.from; q < 1; q += b.step) {
          ctx.beginPath();
          ctx.arc(0, 0, at(q), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case "clip":
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, at(b.r1), 0, Math.PI * 2);
        ctx.arc(0, 0, at(b.r0), 0, Math.PI * 2, true);
        ctx.clip();
        break;
      case "unclip":
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = Math.max(1, at(0.006));
        ctx.beginPath();
        ctx.arc(0, 0, at(0.66), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "label": {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, at(0.3));
        g.addColorStop(0, b.c0);
        g.addColorStop(1, b.c1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, at(0.3), 0, Math.PI * 2);
        ctx.fill();
        if (text) {
          ctx.fillStyle = INK;
          ctx.textAlign = "center";
          // Text stays inside the label: the line at height y can be at most 2·√(r² − y²) wide.
          const fit = (y: number) => 2 * Math.sqrt(Math.max(0, at(0.27) ** 2 - y ** 2));
          ctx.font = `italic ${at(0.055)}px Georgia, serif`;
          ctx.fillText(text.title.length > 22 ? `${text.title.slice(0, 21)}…` : text.title, 0, -at(0.1), fit(at(0.12)));
          ctx.font = `500 ${at(0.03)}px sans-serif`;
          ctx.fillText(text.sub, 0, at(0.16), fit(at(0.16)));
        }
        ctx.fillStyle = "#1c1519";
        ctx.beginPath();
        ctx.arc(0, 0, at(0.03), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "sheen": {
        // A soft highlight; the page counter-rotates it so the shine stays put while the disc spins.
        const g = ctx.createConicGradient(-0.6, 0, 0);
        [[0, 0], [0.05, b.a], [0.11, 0], [0.5, 0], [0.55, b.a * 0.7], [0.61, 0], [1, 0]].forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`));
        ctx.fillStyle = g;
        ctx.fillRect(-R, -R, 2 * R, 2 * R);
        break;
      }
      case "hub":
        ctx.fillStyle = b.clear ? "rgba(251,241,238,0.78)" : "#1b1418";
        ctx.beginPath();
        ctx.arc(0, 0, at(0.33), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1, at(0.008));
        for (const q of [0.33, 0.27]) {
          ctx.beginPath();
          ctx.arc(0, 0, at(q), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(0, 0, at(0.16), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FBF1EE";
        ctx.beginPath();
        ctx.arc(0, 0, at(0.06), 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * at(0.11), Math.sin(a) * at(0.11), at(0.018), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, at(0.012));
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
