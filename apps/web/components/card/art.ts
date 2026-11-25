import { hash, type Card, type Element, type Flower } from "@/lib/card/card";

/**
 * The card's pictures, as SVG strings: the night window (sky, Milky Way, a
 * gold star chart with the sign's constellation, and a bouquet of the birth
 * flower) and the engraved back. Pure functions of the card, so the page and
 * the share image draw exactly the same thing.
 */

export const INK = "#9e3b4c";
export const GOLD = "#e9cf8f";
/** Each element tints the night a little: a glow at the horizon and the badge. */
export const ELEMENT: Record<Element, { glow: string; badge: string; glyph: string }> = {
  Fire: { glow: "#f0a07e", badge: "rgba(240,160,126,.5)", glyph: "M12 3C15 8 18 10 18 14A6 6 0 0 1 6 14C6 11 8 10 9 7C10 9 11 10 12 10C12 8 11 6 12 3Z" },
  Water: { glow: "#93b8ee", badge: "rgba(147,184,238,.5)", glyph: "M12 3C15 8 18 11 18 14A6 6 0 0 1 6 14C6 11 9 8 12 3Z" },
  Air: { glow: "#98dcc8", badge: "rgba(152,220,200,.5)", glyph: "M4 10C9 10 15 8 15 5C15 3 12 3 12 5M5 14C11 14 19 13 19 16C19 18 16 18 16 16M3 18H11" },
  Earth: { glow: "#ecc983", badge: "rgba(236,201,131,.5)", glyph: "M12 3L19 10L12 21L5 10ZM5 10H19M12 3V21" },
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A seeded PRNG (mulberry32), so the sky's dust is the same on every screen. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One petal pointing up from (0,0): length l, half-width w, with the flower's kind of tip. */
function petal(l: number, w: number, tip: Flower["tip"]): string {
  if (tip === "point") return `M0 0C${r1(w)} ${r1(-l * 0.3)} ${r1(w * 0.55)} ${r1(-l * 0.8)} 0 ${r1(-l)}C${r1(-w * 0.55)} ${r1(-l * 0.8)} ${r1(-w)} ${r1(-l * 0.3)} 0 0Z`;
  if (tip === "notch")
    return `M0 0C${r1(w)} ${r1(-l * 0.3)} ${r1(w)} ${r1(-l * 0.9)} ${r1(w * 0.4)} ${r1(-l)}L0 ${r1(-l * 0.9)}L${r1(-w * 0.4)} ${r1(-l)}C${r1(-w)} ${r1(-l * 0.9)} ${r1(-w)} ${r1(-l * 0.3)} 0 0Z`;
  if (tip === "frill") {
    let d = `M0 0C${r1(w)} ${r1(-l * 0.3)} ${r1(w * 1.05)} ${r1(-l * 0.75)} ${r1(w * 0.9)} ${r1(-l * 0.92)}`;
    for (let i = 1; i <= 5; i++) {
      const x = w * 0.9 - (i * w * 1.8) / 5;
      d += `L${r1(x + w * 0.18)} ${r1(-l * (i % 2 ? 1 : 0.94))}L${r1(x)} ${r1(-l * 0.92)}`;
    }
    return d + `C${r1(-w * 1.05)} ${r1(-l * 0.75)} ${r1(-w)} ${r1(-l * 0.3)} 0 0Z`;
  }
  return `M0 0C${r1(w * 1.1)} ${r1(-l * 0.25)} ${r1(w * 0.9)} ${r1(-l)} 0 ${r1(-l)}C${r1(-w * 0.9)} ${r1(-l)} ${r1(-w * 1.1)} ${r1(-l * 0.25)} 0 0Z`;
}

/** A whole bloom at (cx, cy), radius R: layered petals shading from the flower's inner to outer colour, a vein in each, then the heart. */
function bloom(f: Flower, cx: number, cy: number, R: number, id: string, turn = 0): string {
  let s = `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${R}"><stop offset="0" stop-color="${f.inner}"/><stop offset=".55" stop-color="${f.inner}"/><stop offset="1" stop-color="${f.outer}"/></radialGradient></defs>`;
  for (let L = 0; L < f.layers; L++) {
    const k = 1 - L * (0.62 / Math.max(f.layers, 1));
    const l = R * f.length * k;
    const w = ((Math.PI * R * k) / f.petals) * f.width * 1.25 + 1;
    const off = turn + (L * Math.PI) / f.petals;
    for (let i = 0; i < f.petals; i++) {
      const a = (i / f.petals) * 360 + (off * 180) / Math.PI;
      s += `<g transform="translate(${cx} ${cy}) rotate(${r1(a)})"><path d="${petal(l, w, f.tip)}" fill="url(#${id})" stroke="${INK}" stroke-width=".55" stroke-opacity=".75"/><path d="M0 ${r1(-l * 0.12)}V${r1(-l * 0.68)}" stroke="${INK}" stroke-width=".35" stroke-opacity=".35"/></g>`;
    }
  }
  const c = R * f.cup;
  if (f.name === "daffodil" || f.name === "narcissus") {
    s += `<circle cx="${cx}" cy="${cy}" r="${r1(c)}" fill="${f.name === "daffodil" ? "#f6b13c" : "#f2c45a"}" stroke="${INK}" stroke-width=".6"/><circle cx="${cx}" cy="${cy}" r="${r1(c * 0.55)}" fill="none" stroke="${INK}" stroke-width=".4" stroke-dasharray="1.2 1.2"/>`;
  } else {
    s += `<circle cx="${cx}" cy="${cy}" r="${r1(c)}" fill="#f2c45a" stroke="${INK}" stroke-width=".55"/>`;
    const n = Math.max(6, Math.round(c * 1.6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s += `<circle cx="${r1(cx + Math.cos(a) * c * 0.62)}" cy="${r1(cy + Math.sin(a) * c * 0.62)}" r=".55" fill="${INK}" opacity=".7"/>`;
    }
  }
  return s;
}

/** A leaf from (x, y) in direction a (radians), with a midrib and veins. */
function leaf(x: number, y: number, a: number, l: number): string {
  const w = l * 0.32;
  return `<g transform="translate(${x} ${y}) rotate(${r1((a * 180) / Math.PI)})"><path d="M0 0C${r1(l * 0.3)} ${r1(-w)} ${r1(l * 0.75)} ${r1(-w * 0.9)} ${l} 0C${r1(l * 0.75)} ${r1(w * 0.9)} ${r1(l * 0.3)} ${r1(w)} 0 0Z" fill="rgba(170,210,160,.55)" stroke="#d9ead0" stroke-width=".6"/><path d="M0 0H${r1(l * 0.9)}M${r1(l * 0.3)} 0l${r1(l * 0.12)} ${r1(-w * 0.5)}M${r1(l * 0.3)} 0l${r1(l * 0.12)} ${r1(w * 0.5)}M${r1(l * 0.55)} 0l${r1(l * 0.1)} ${r1(-w * 0.45)}M${r1(l * 0.55)} 0l${r1(l * 0.1)} ${r1(w * 0.45)}" stroke="#e7f2df" stroke-width=".4" fill="none"/></g>`;
}

/** The picture window: 252 × 148 (the card's window is about 1.7 : 1). */
export function windowArt(card: Card): string {
  const W = 252, H = 148;
  const el = ELEMENT[card.sign.element];
  const rnd = prng(hash(card.sign.name + card.flower.name));
  let s = `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#211c3d"/><stop offset=".55" stop-color="#3a3064"/><stop offset="1" stop-color="#4f4280"/></linearGradient>
<radialGradient id="horizon" cx=".5" cy="1.05" r=".75"><stop offset="0" stop-color="${el.glow}" stop-opacity=".6"/><stop offset=".6" stop-color="${el.glow}" stop-opacity=".12"/><stop offset="1" stop-color="${el.glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="milky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf1ee" stop-opacity="0"/><stop offset=".5" stop-color="#fbf1ee" stop-opacity=".16"/><stop offset="1" stop-color="#fbf1ee" stop-opacity="0"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#fff8e4" stop-opacity=".95"/><stop offset=".35" stop-color="${GOLD}" stop-opacity=".45"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
</defs><rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // the Milky Way: a soft band across the sky, thick with faint dust
  s += `<g transform="rotate(-24 ${W / 2} ${H / 2})"><rect x="-40" y="${H / 2 - 30}" width="${W + 80}" height="60" fill="url(#milky)"/>`;
  for (let i = 0; i < 140; i++) {
    const x = -30 + rnd() * (W + 60);
    const y = H / 2 + (rnd() + rnd() + rnd() - 1.5) * 26;
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.25 + rnd() * 0.5)}" fill="#fbf1ee" opacity="${r1(0.25 + rnd() * 0.5)}"/>`;
  }
  s += `</g>`;
  for (let i = 0; i < 46; i++) s += `<circle cx="${r1(rnd() * W)}" cy="${r1(rnd() * H * 0.75)}" r="${r1(0.3 + rnd() * 0.7)}" fill="#fbf1ee" opacity="${r1(0.4 + rnd() * 0.5)}"/>`;
  s += `<rect width="${W}" height="${H}" fill="url(#horizon)"/>`;
  // the star chart: rings, a graduated scale, a faint grid of meridians
  const cx = 126, cy = 66, R = 56;
  s += `<g fill="none" stroke="${GOLD}" stroke-opacity=".5"><circle cx="${cx}" cy="${cy}" r="${R}" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="${R - 6}" stroke-width=".45"/><circle cx="${cx}" cy="${cy}" r="${R * 0.55}" stroke-width=".35" stroke-dasharray="1.5 2.5"/>`;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, o = i % 6 ? R - 3 : R - 6;
    s += `<path d="M${r1(cx + Math.cos(a) * o)} ${r1(cy + Math.sin(a) * o)}L${r1(cx + Math.cos(a) * R)} ${r1(cy + Math.sin(a) * R)}" stroke-width="${i % 6 ? 0.4 : 0.7}"/>`;
  }
  for (const a of [0, 60, 120]) s += `<ellipse cx="${cx}" cy="${cy}" rx="${R - 6}" ry="${r1((R - 6) * 0.35)}" transform="rotate(${a} ${cx} ${cy})" stroke-width=".3" stroke-opacity=".6"/>`;
  s += `</g>`;
  // the constellation, mapped into the chart
  const pts = card.sign.stars.map(([x, y, m]) => [r1(cx - R * 0.72 + (x / 100) * R * 1.44), r1(cy - R * 0.62 + (y / 100) * R * 1.24), m] as const);
  s += `<path d="${card.sign.lines.map(([a, b]) => `M${pts[a][0]} ${pts[a][1]}L${pts[b][0]} ${pts[b][1]}`).join("")}" stroke="#fbf1ee" stroke-opacity=".7" stroke-width=".7" fill="none"/>`;
  for (const [x, y, m] of pts) {
    const k = m === 1 ? 1 : m === 2 ? 0.7 : 0.48;
    s += `<circle cx="${x}" cy="${y}" r="${r1(9 * k)}" fill="url(#halo)"/><path d="M${x} ${r1(y - 5 * k)}Q${r1(x + 0.7 * k)} ${r1(y - 0.7 * k)} ${r1(x + 5 * k)} ${y}Q${r1(x + 0.7 * k)} ${r1(y + 0.7 * k)} ${x} ${r1(y + 5 * k)}Q${r1(x - 0.7 * k)} ${r1(y + 0.7 * k)} ${r1(x - 5 * k)} ${y}Q${r1(x - 0.7 * k)} ${r1(y - 0.7 * k)} ${x} ${r1(y - 5 * k)}Z" fill="#fffaf0"/>`;
  }
  // the bouquet: a main bloom, two smaller ones and buds, on stems with leaves (drawn for a deeper window, lifted to fit)
  const f = card.flower;
  s += `<g transform="translate(0 -46)">`;
  s += `<g fill="none" stroke="#cfe2c0" stroke-width="1.1" stroke-linecap="round"><path d="M126 190C125 176 127 162 126 150M94 190C96 180 92 172 88 166M160 190C158 180 162 172 166 164M110 190C112 170 104 156 100 146M144 190C142 172 150 158 154 150"/></g>`;
  s += leaf(124, 176, -2.5, 26) + leaf(128, 170, -0.55, 24) + leaf(92, 180, -2.9, 16) + leaf(162, 178, -0.25, 16);
  for (const [x, y] of [[100, 146], [154, 150]]) s += `<ellipse cx="${x}" cy="${y - 3}" rx="3.2" ry="5" fill="${f.outer}" fill-opacity=".85" stroke="${INK}" stroke-width=".5"/><path d="M${x - 3} ${y}q3 3 6 0" stroke="#cfe2c0" stroke-width=".8" fill="none"/>`;
  s += bloom(f, 88, 164, 12, "fl-b", 0.4) + bloom(f, 166, 162, 11, "fl-c", 0.9) + bloom(f, 126, 146, 25, "fl-a") + `</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${s}</svg>`;
}

/**
 * The card's back: a guilloche (the fine looping lines on banknotes), made of
 * hypotrochoids, round a medallion. 264 × 368.
 */
export function backArt(): string {
  const W = 264, H = 368, cx = W / 2, cy = H / 2;
  const curve = (R: number, r: number, d: number, sx: number, sy: number, steps = 900) => {
    let p = "";
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * r;
      const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      p += `${i ? "L" : "M"}${r1(cx + x * sx)} ${r1(cy + y * sy)}`;
    }
    return p;
  };
  let s = `<rect width="${W}" height="${H}" fill="#fdf7f3"/><g fill="none" stroke="${INK}" stroke-linejoin="round">`;
  s += `<path d="${curve(96, 7, 34, 1, 1.32)}" stroke-width=".35" stroke-opacity=".55"/>`;
  s += `<path d="${curve(70, 5, 26, 1, 1.3)}" stroke-width=".35" stroke-opacity=".7"/>`;
  s += `<path d="${curve(44, 4, 12, 1, 1.25)}" stroke-width=".4" stroke-opacity=".8"/></g>`;
  s += `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="${INK}" stroke-width="1.2"/><rect x="15" y="15" width="${W - 30}" height="${H - 30}" rx="6" fill="none" stroke="${INK}" stroke-width=".5" stroke-opacity=".6"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="30" fill="#fdf7f3" stroke="${INK}" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="${INK}" stroke-width=".5"/>`;
  s += `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="var(--font-playfair), Georgia, serif" font-style="italic" font-size="22" fill="${INK}">bp</text>`;
  s += `<text x="${cx}" y="${H - 30}" text-anchor="middle" font-family="var(--font-inter), sans-serif" font-size="7" letter-spacing="3" fill="${INK}">THE BIRTHDAY PRESS · 2026</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}
