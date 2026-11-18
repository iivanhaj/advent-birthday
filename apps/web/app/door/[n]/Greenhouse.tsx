"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { useLivePushes } from "@/components/building/useLivePushes";
import { constellation, starPath } from "@/lib/constellations";
import { KINDS, mainKind, type FileCounts, type FileKind } from "@/lib/file-kinds";
import { commitTitle, pushesByDoor, seeded, type PushRow } from "@/lib/pushes";

type Props = { initialPushes: PushRow[]; todayDoor: number | null };

const INK = "#9E3B4C";
const PAPER = "#FBF1EE";
const STEM = "#6E9C69";
const NO_KIND: FileKind = "other";
const r1 = (n: number) => Math.round(n * 10) / 10;
const ALL_KINDS = Object.keys(KINDS) as FileKind[];

// ─────────────────────────────────────────────────────────────────────────────
// Layout: the wide (desktop) and tall (phone) greenhouses
// ─────────────────────────────────────────────────────────────────────────────

type Layout = {
  id: string;
  w: number;
  h: number;
  ground: number;
  dome: { x0: number; x1: number; wallTop: number; top: number };
  /** benches: y of the top plank, and which doors' pots stand on it */
  benches: { y: number; x0: number; x1: number; doors: number[]; ceiling?: number }[];
  pot: number;
  maxLean: number;
  head: number;
  stars: [number, number][];
  starRadius: number;
  shooting: string[];
};

const WIDE: Layout = {
  id: "wide",
  w: 1100,
  h: 680,
  ground: 630,
  dome: { x0: 170, x1: 930, wallTop: 420, top: 120 },
  benches: [{ y: 594, x0: 196, x1: 904, doors: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }],
  pot: 32,
  maxLean: 11,
  head: 12.5,
  stars: [
    [85, 120], [1015, 120], [260, 44], [840, 44], [85, 300], [1015, 300],
    [440, 22], [660, 22], [85, 470], [1015, 470], [90, 610], [1010, 610],
  ],
  starRadius: 50,
  shooting: ["M40 40 L230 150", "M1060 70 L880 170"],
};

const TALL: Layout = {
  id: "tall",
  w: 520,
  h: 980,
  ground: 930,
  dome: { x0: 22, x1: 498, wallTop: 670, top: 350 },
  benches: [
    { y: 660, x0: 48, x1: 472, doors: [0, 1, 2, 3, 4, 5] },
    { y: 896, x0: 40, x1: 480, doors: [6, 7, 8, 9, 10, 11], ceiling: 684 },
  ],
  pot: 32,
  maxLean: 14,
  head: 12,
  stars: [
    [70, 60], [195, 64], [325, 58], [450, 62],
    [72, 165], [196, 170], [326, 163], [448, 168],
    [70, 268], [194, 272], [327, 266], [450, 272],
  ],
  starRadius: 36,
  shooting: ["M20 20 L170 90"],
};

/** Top of the glass at x (the dome's curve, or the wall below it). */
function glassTop(L: Layout, x: number): number {
  const { x0, x1, wallTop, top } = L.dome;
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const k = Math.min(1, Math.abs(x - cx) / rx);
  return wallTop - (wallTop - top) * Math.sqrt(1 - k * k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Plants
// ─────────────────────────────────────────────────────────────────────────────

type Species = "cosmos" | "tulip" | "bell" | "lavender" | "rose";
type Stem = {
  push: PushRow;
  door: number;
  x: number;
  potTop: number;
  stem: string;
  leaves: { x: number; y: number; angle: number; len: number }[];
  hx: number;
  hy: number;
  species: Species;
  /** one tint per petal, split between the stacks the push touched (most-touched first) */
  petals: FileKind[];
  main: FileKind;
  phase: number;
};

/**
 * Split `n` petals between a push's file kinds, in proportion to how many files
 * of each it touched. {ts: 4, css: 1, sql: 1} over 8 petals → 5 ts, 2 css, 1 sql
 * (most-touched first, every kind present gets at least one petal).
 */
function petalKinds(files: FileCounts | null | undefined, n: number): FileKind[] {
  const entries = ALL_KINDS.map((k) => [k, files?.[k] ?? 0] as const).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return Array(n).fill(NO_KIND);
  const total = entries.reduce((a, [, c]) => a + c, 0);
  const shares = entries.map(([k, c]) => ({ k, n: Math.max(1, Math.round((c / total) * n)) }));
  while (shares.reduce((a, s) => a + s.n, 0) > n) shares.find((s) => s.n === Math.max(...shares.map((x) => x.n)))!.n--;
  while (shares.reduce((a, s) => a + s.n, 0) < n) shares[0].n++;
  return shares.flatMap((s) => Array(s.n).fill(s.k));
}

/**
 * Lay out one pot's stems. Stem 0 stands in the middle; the rest alternate
 * left/right, leaning further and growing a little shorter, so the pot fills
 * out like a real plant. Every stem stays within `maxLean` of the pot's centre
 * and below the glass (checked where its furthest stem can reach), so
 * neighbouring pots never collide.
 */
function stemsFor(L: Layout, door: number, x: number, potTop: number, list: PushRow[], ceiling: number): Stem[] {
  const reach = L.maxLean + L.head * 1.3;
  const glass = Math.max(glassTop(L, x - reach), glassTop(L, x), glassTop(L, x + reach));
  // leave room above the stem for the tallest flower (a lavender spike is ~2.6 heads tall)
  const avail = Math.max(50, potTop - Math.max(ceiling + L.head * 2.8, glass + 26 + L.head * 1.4));
  const sides = Math.max(1, Math.ceil((list.length - 1) / 2));
  const SPECIES: Species[] = ["cosmos", "tulip", "bell", "lavender", "rose"];
  return list.map((push, i) => {
    const r = seeded(push.sha ?? push.delivery_id);
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    const lean = r1((side / sides) * L.maxLean + (r() - 0.5) * 3);
    // busier days grow taller plants (but never into the glass): 1 push ≈ 100, 6+ ≈ 190
    const target = 120 + 26 * Math.min(list.length, 6);
    const h = r1(Math.min(avail, target * (1 - 0.11 * Math.abs(side)) + r() * 14));
    const hx = r1(x + lean);
    const hy = r1(potTop - h);
    const bend = (r() - 0.5) * 8;
    const stem = `M${x} ${potTop} C${r1(x + bend)} ${r1(potTop - h * 0.35)} ${r1(x + lean * 0.4 - bend * 0.5)} ${r1(potTop - h * 0.7)} ${hx} ${hy}`;
    const nLeaves = 2 + (r() < 0.45 ? 1 : 0);
    const leaves = Array.from({ length: nLeaves }, (_, k) => {
      const t = 0.22 + k * 0.2 + r() * 0.06;
      const s = (k + i) % 2 ? 1 : -1;
      return {
        x: r1(x + lean * t * t + bend * 0.3 * t),
        y: r1(potTop - h * t),
        // leaves point up and out: -35° on the right, -145° on the left
        angle: s > 0 ? -28 - r() * 18 : -152 + r() * 18,
        len: r1(L.head * (1.5 + r() * 0.5) * (1 - k * 0.12)),
      };
    });
    const species = SPECIES[Math.floor(r() * SPECIES.length)];
    const nPetals = species === "cosmos" ? 8 : species === "rose" ? 5 : species === "lavender" ? 7 : 3;
    return {
      push,
      door,
      x,
      potTop,
      stem,
      leaves,
      hx,
      hy,
      species,
      petals: petalKinds(push.files, nPetals),
      main: mainKind(push.files) ?? NO_KIND,
      phase: r1(r() * 6),
    };
  });
}

const fill = (k: FileKind, id: string) => `url(#petal-${k}-${id})`;

/** The flower at the top of a stem, drawn around (0,0) pointing up; the caller places it. */
function Flower({ s, size, id }: { s: Stem; size: number; id: string }) {
  const z = size;
  const ink = { stroke: INK, strokeWidth: 0.9, strokeOpacity: 0.85, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };
  const petal = `M0 0 C${r1(-z * 0.34)} ${r1(-z * 0.38)} ${r1(-z * 0.3)} ${r1(-z * 1.02)} 0 ${r1(-z * 1.16)} C${r1(z * 0.3)} ${r1(-z * 1.02)} ${r1(z * 0.34)} ${r1(-z * 0.38)} 0 0Z`;
  switch (s.species) {
    case "cosmos":
      return (
        <g>
          {s.petals.map((k, i) => (
            <path key={i} d={petal} transform={`rotate(${i * 45 + s.phase * 7})`} fill={fill(k, id)} {...ink} />
          ))}
          <circle r={r1(z * 0.3)} fill="#F4CF6E" {...ink} />
          {[[-0.1, -0.08], [0.1, 0.02], [-0.02, 0.12]].map(([a, b], i) => (
            <circle key={i} cx={r1(a * z)} cy={r1(b * z)} r={0.9} fill="#B8862E" />
          ))}
        </g>
      );
    case "rose":
      return (
        <g>
          {s.petals.map((k, i) => (
            <path key={i} d={`M0 0 C${r1(-z * 0.6)} ${r1(-z * 0.2)} ${r1(-z * 0.55)} ${r1(-z * 0.9)} 0 ${r1(-z * 0.85)} C${r1(z * 0.55)} ${r1(-z * 0.9)} ${r1(z * 0.6)} ${r1(-z * 0.2)} 0 0Z`} transform={`rotate(${i * 72 + s.phase * 9})`} fill={fill(k, id)} {...ink} />
          ))}
          <path d={`M${r1(z * 0.32)} 0 A${r1(z * 0.32)} ${r1(z * 0.32)} 0 1 0 ${r1(-z * 0.16)} ${r1(z * 0.26)} M${r1(-z * 0.16)} ${r1(z * 0.26)} A${r1(z * 0.2)} ${r1(z * 0.2)} 0 1 1 ${r1(z * 0.12)} ${r1(-z * 0.1)}`} fill="none" {...ink} />
        </g>
      );
    case "tulip":
      return (
        <g>
          <path d={`M0 ${r1(z * 0.2)} C${r1(-z * 0.95)} 0 ${r1(-z * 0.95)} ${r1(-z * 1.1)} ${r1(-z * 0.38)} ${r1(-z * 1.5)} C${r1(-z * 0.22)} ${r1(-z * 0.9)} ${r1(-z * 0.1)} ${r1(-z * 0.3)} 0 ${r1(z * 0.2)}Z`} fill={fill(s.petals[1], id)} {...ink} />
          <path d={`M0 ${r1(z * 0.2)} C${r1(z * 0.95)} 0 ${r1(z * 0.95)} ${r1(-z * 1.1)} ${r1(z * 0.38)} ${r1(-z * 1.5)} C${r1(z * 0.22)} ${r1(-z * 0.9)} ${r1(z * 0.1)} ${r1(-z * 0.3)} 0 ${r1(z * 0.2)}Z`} fill={fill(s.petals[2], id)} {...ink} />
          <path d={`M0 ${r1(z * 0.3)} C${r1(-z * 0.58)} ${r1(z * 0.1)} ${r1(-z * 0.52)} ${r1(-z * 1.3)} 0 ${r1(-z * 1.62)} C${r1(z * 0.52)} ${r1(-z * 1.3)} ${r1(z * 0.58)} ${r1(z * 0.1)} 0 ${r1(z * 0.3)}Z`} fill={fill(s.petals[0], id)} {...ink} />
        </g>
      );
    case "bell":
      // the stem arches over and the bell hangs from its tip
      return (
        <g>
          <path d={`M0 0 Q${r1(z * 0.9)} ${r1(-z * 0.7)} ${r1(z * 1.1)} ${r1(z * 0.3)}`} fill="none" stroke={STEM} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <g transform={`translate(${r1(z * 1.1)} ${r1(z * 0.35)})`}>
            <path d={`M${r1(-z * 0.55)} ${r1(z * 0.95)} C${r1(-z * 0.6)} ${r1(z * 0.2)} ${r1(-z * 0.4)} 0 0 0 C${r1(z * 0.4)} 0 ${r1(z * 0.6)} ${r1(z * 0.2)} ${r1(z * 0.55)} ${r1(z * 0.95)} Q${r1(z * 0.3)} ${r1(z * 0.8)} 0 ${r1(z * 1.05)} Q${r1(-z * 0.3)} ${r1(z * 0.8)} ${r1(-z * 0.55)} ${r1(z * 0.95)}Z`} fill={fill(s.petals[0], id)} {...ink} />
            <path d={`M${r1(-z * 0.22)} ${r1(z * 0.25)} Q${r1(-z * 0.25)} ${r1(z * 0.6)} ${r1(-z * 0.18)} ${r1(z * 0.92)} M${r1(z * 0.2)} ${r1(z * 0.25)} Q${r1(z * 0.24)} ${r1(z * 0.6)} ${r1(z * 0.2)} ${r1(z * 0.9)}`} fill="none" {...ink} strokeOpacity={0.4} />
          </g>
        </g>
      );
    case "lavender":
      // a spike of small buds climbing the end of the stem
      return (
        <g>
          <path d={`M0 0 L0 ${r1(-z * 2.4)}`} stroke={STEM} strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {s.petals.map((k, i) => (
            <ellipse key={i} cx={i % 2 ? r1(z * 0.22) : r1(-z * 0.22)} cy={r1(-z * 0.3 - i * z * 0.32)} rx={r1(z * 0.24 * (1 - i * 0.05))} ry={r1(z * 0.34 * (1 - i * 0.05))} fill={fill(k, id)} {...ink} />
          ))}
        </g>
      );
  }
}

function Plant({ s, L, fresh, onHover }: { s: Stem; L: Layout; fresh: boolean; onHover: (on: boolean) => void }) {
  // sway gently from the base of the stem (transform-box: view-box so the origin is in SVG units)
  const sway = { transformBox: "view-box" as const, transformOrigin: `${s.x}px ${s.potTop}px`, animationDelay: `${-s.phase * 1.3}s`, animationDuration: `${5.5 + (s.phase % 3)}s` };
  return (
    <g className="plant-sway" style={sway}>
      <path d={s.stem} fill="none" stroke={STEM} strokeWidth={1.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} className={fresh ? "stem-in" : undefined} vectorEffect="non-scaling-stroke" />
      {s.leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${r1(l.angle)})`} className={fresh ? "head-in" : undefined}>
          <path d={`M0 0 C${r1(l.len * 0.3)} ${r1(-l.len * 0.28)} ${r1(l.len * 0.78)} ${r1(-l.len * 0.24)} ${l.len} 0 C${r1(l.len * 0.78)} ${r1(l.len * 0.2)} ${r1(l.len * 0.3)} ${r1(l.len * 0.22)} 0 0Z`} fill={`url(#leaf-${L.id})`} stroke={STEM} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={`M0.5 0 L${r1(l.len * 0.88)} 0`} stroke={STEM} strokeWidth={0.7} strokeOpacity={0.8} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      <g transform={`translate(${s.hx} ${s.hy})`}>
        <g className={fresh ? "head-in" : undefined}>
          <Flower s={s} size={L.head} id={L.id} />
        </g>
      </g>
      <rect x={s.hx - 13} y={s.hy - 18} width={26} height={30} fill="transparent" className="cursor-pointer" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────────────────────

type Hover = { layout: string; x: number; y: number; push: PushRow; door: number; what: "stem" | "star" } | null;

function Defs({ L }: { L: Layout }) {
  return (
    <defs>
      {/* petal shading: the stack's tint at the base, fading to near-white at the tip */}
      {ALL_KINDS.map((k) => (
        <linearGradient key={k} id={`petal-${k}-${L.id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={KINDS[k].tint} />
          <stop offset="0.72" stopColor={KINDS[k].tint} />
          <stop offset="1" stopColor="#FFFBF8" />
        </linearGradient>
      ))}
      <linearGradient id={`leaf-${L.id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#CFE3C4" />
        <stop offset="1" stopColor="#E8F2E1" />
      </linearGradient>
      <radialGradient id={`light-${L.id}`} cx="50%" cy="82%" r="75%">
        <stop offset="0" stopColor="#FFF2D6" />
        <stop offset="0.6" stopColor="#FBEDE6" />
        <stop offset="1" stopColor="#F0DEDA" />
      </radialGradient>
      <linearGradient id={`ray-${L.id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`pot-${L.id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFF7F3" />
        <stop offset="0.7" stopColor="#F7E7E1" />
        <stop offset="1" stopColor="#EBD3CB" />
      </linearGradient>
      <radialGradient id={`glow-${L.id}`}>
        <stop offset="0" stopColor="#FFF6E0" stopOpacity="0.85" />
        <stop offset="1" stopColor="#FFF6E0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`firefly-${L.id}`}>
        <stop offset="0" stopColor="#FFE7A3" stopOpacity="1" />
        <stop offset="0.35" stopColor="#FFE7A3" stopOpacity="0.55" />
        <stop offset="1" stopColor="#FFE7A3" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`glass-${L.id}`}>
        <path d={domePath(L) + " Z"} />
      </clipPath>
    </defs>
  );
}

function domePath(L: Layout) {
  const { x0, x1, wallTop, top } = L.dome;
  return `M${x0} ${L.ground} V${wallTop} A${(x1 - x0) / 2} ${wallTop - top} 0 0 1 ${x1} ${wallTop} V${L.ground}`;
}

function Scene({ L, byDoor, fresh, todayDoor, setHover }: { L: Layout; byDoor: Map<number, PushRow[]>; fresh: Set<string>; todayDoor: number | null; setHover: (h: Hover) => void }) {
  const { x0, x1, wallTop, top } = L.dome;
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = wallTop - top;
  const ribs = [-0.66, -0.33, 0, 0.33, 0.66].map((k) => `M${r1(cx + rx * k)} ${L.ground} V${wallTop} Q${r1(cx + rx * k * 0.6)} ${r1(top + ry * 0.12)} ${cx} ${top}`);
  const rings = [0.3, 0.58, 0.82].map((k) => {
    const half = rx * Math.sqrt(1 - k * k);
    return `M${r1(cx - half)} ${r1(wallTop - ry * k)} H${r1(cx + half)}`;
  });
  const pots = L.benches.flatMap((b) =>
    b.doors.map((door, i) => ({ door, bench: b, x: r1(b.x0 + 28 + (i * (b.x1 - b.x0 - 56)) / (b.doors.length - 1)) })),
  );
  // fireflies drifting inside the glass (positions from integer hashing, so SSR and browser agree)
  const fireflies = Array.from({ length: L.id === "wide" ? 12 : 9 }, (_, i) => {
    const r = seeded(`ff-${L.id}-${i}`);
    return { x: r1(x0 + 40 + r() * (rx * 2 - 80)), y: r1(top + ry * 0.5 + r() * (L.ground - top - ry * 0.7)), d: r1(r() * 9), s: r1(2.5 + r() * 2.5) };
  });

  const star = (door: number) => {
    const list = byDoor.get(door) ?? [];
    if (!list.length) return null;
    const c = constellation(door, list, L.stars[door], L.starRadius);
    return (
      <g key={door} className="constellation-drift" style={{ animationDelay: `${-door * 2.1}s`, animationDuration: `${17 + (door % 4) * 3}s` }}>
        {c.stars.slice(1).map((s, i) => (
          <line key={s.push.delivery_id} x1={c.stars[i].x} y1={c.stars[i].y} x2={s.x} y2={s.y} stroke={PAPER} strokeOpacity={0.45} strokeWidth={1} pathLength={1} strokeDasharray={1} className={fresh.has(s.push.delivery_id) ? "star-line-in" : undefined} vectorEffect="non-scaling-stroke" />
        ))}
        {c.stars.map((s, i) => (
          <g key={s.push.delivery_id} transform={`translate(${s.x} ${s.y})`}>
            <g className={fresh.has(s.push.delivery_id) ? "star-in" : "star-twinkle"} style={{ animationDelay: `${-((i * 1.3 + door) % 4)}s` }}>
              <circle r={s.size * 4} fill={`url(#glow-${L.id})`} />
              <path d={starPath(s.size * 1.45)} fill={PAPER} />
            </g>
            <circle r={13} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHover({ layout: L.id, x: s.x, y: s.y - 6, push: s.push, door, what: "star" })} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
        <text x={c.label.x} y={c.label.y} textAnchor="middle" className="font-hand" fontSize={L.id === "wide" ? 17 : 15} fill={PAPER} fillOpacity={0.75}>
          door {door}
          {door === todayDoor ? " · today" : ""}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${L.w} ${L.h}`} className="block h-auto w-full overflow-visible" aria-hidden>
      <Defs L={L} />

      {/* ── sky ── */}
      {Array.from({ length: 12 }, (_, d) => star(d))}
      <g stroke="#FFF6E0" strokeWidth={1.6} strokeLinecap="round" fill="none">
        {L.shooting.map((d, i) => (
          <path key={d} d={d} pathLength={1} className="shooting-star" style={{ animationDelay: `${3 + i * 7}s` }} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <path d={`M-600 ${L.ground} H${L.w + 600}`} stroke={PAPER} strokeOpacity={0.35} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />

      {/* ── the greenhouse: warm lit glass ── */}
      <path d={domePath(L) + " Z"} fill={`url(#light-${L.id})`} />
      <g clipPath={`url(#glass-${L.id})`}>
        {/* light falling through the glass */}
        <polygon points={`${cx - rx * 0.55},${top} ${cx - rx * 0.25},${top} ${cx + rx * 0.05},${L.ground} ${cx - rx * 0.5},${L.ground}`} fill={`url(#ray-${L.id})`} opacity={0.5} />
        <polygon points={`${cx + rx * 0.1},${top} ${cx + rx * 0.3},${top} ${cx + rx * 0.62},${L.ground} ${cx + rx * 0.2},${L.ground}`} fill={`url(#ray-${L.id})`} opacity={0.35} />
        {/* fireflies */}
        {fireflies.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.s * 2.4} fill={`url(#firefly-${L.id})`} className="firefly" style={{ animationDelay: `${-f.d}s` }} />
        ))}
      </g>
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        {ribs.map((d) => (
          <path key={d} d={d} strokeOpacity={0.4} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        ))}
        {rings.map((d) => (
          <path key={d} d={d} strokeOpacity={0.35} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`M${x0} ${wallTop} H${x1}`} strokeOpacity={0.6} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        {[[x0 + 44, wallTop + 44], [x1 - 70, wallTop + 64], [cx - rx * 0.42, top + ry * 0.36], [cx + rx * 0.26, top + ry * 0.2]].map(([gx, gy]) => (
          <path key={`${gx}`} d={`M${r1(gx)} ${r1(gy)} l14 -14 M${r1(gx + 6)} ${r1(gy + 6)} l10 -10`} strokeOpacity={0.28} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* ── benches: wooden planks with a little grain ── */}
      {L.benches.map((b) => (
        <g key={b.y}>
          <rect x={b.x0} y={b.y} width={b.x1 - b.x0} height={8} fill="#F3E3DA" stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <path d={`M${b.x0 + 30} ${b.y + 4} h40 M${b.x0 + 140} ${b.y + 3} h60 M${b.x1 - 160} ${b.y + 5} h50 M${b.x1 - 60} ${b.y + 3} h30`} stroke={INK} strokeOpacity={0.25} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          <path d={`M${b.x0 + 10} ${b.y + 8} V${Math.min(L.ground, b.y + 36)} M${b.x1 - 10} ${b.y + 8} V${Math.min(L.ground, b.y + 36)}`} stroke={INK} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}

      {/* ── pots, and every push as a stem in its day's pot ── */}
      {pots.map(({ door, x, bench }) => {
        const half = L.pot / 2;
        const potTop = bench.y - 26;
        const list = byDoor.get(door) ?? [];
        const stems = stemsFor(L, door, x, potTop + 4, list, bench.ceiling ?? 0);
        const isToday = door === todayDoor;
        return (
          <g key={door}>
            {/* a soft shadow on the bench */}
            <ellipse cx={x + 2} cy={bench.y + 1} rx={half + 4} ry={2.5} fill="#000" opacity={0.08} />
            {isToday && <circle cx={x} cy={potTop - 40} r={70} fill={`url(#firefly-${L.id})`} opacity={0.28} />}
            {stems.map((s) => (
              <Plant
                key={s.push.delivery_id}
                s={s}
                L={L}
                fresh={fresh.has(s.push.delivery_id)}
                onHover={(on) => setHover(on ? { layout: L.id, x: s.hx, y: s.hy - L.head * 1.6, push: s.push, door, what: "stem" } : null)}
              />
            ))}
            {/* the pot, in front of its stems: soil, body with side shading, rim */}
            <ellipse cx={x} cy={potTop + 4} rx={half - 1} ry={3} fill="#7A5A48" />
            <path d={`M${r1(x - half)} ${potTop + 4} L${r1(x - half + 4)} ${bench.y} H${r1(x + half - 4)} L${r1(x + half)} ${potTop + 4} Z`} fill={`url(#pot-${L.id})`} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <rect x={r1(x - half - 2.5)} y={potTop - 1} width={L.pot + 5} height={6} rx={1} fill={isToday ? "#FBE3B0" : "#FFF7F3"} stroke={INK} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
            <text x={x} y={bench.y - 6} textAnchor="middle" className="font-hand" fontSize={12} fill={INK}>
              {door}
            </text>
          </g>
        );
      })}

      {/* finial + outer frame on top */}
      <path d={`M${cx} ${top} V${top - 18} M${cx - 6} ${top - 11} L${cx} ${top - 20} L${cx + 6} ${top - 11}`} fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={domePath(L)} fill="none" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Door 1 · the living garden. A fine-line greenhouse at night. Inside, one pot
 * per door: every push grows a new stem in its day's pot, with petals tinted by
 * the tech stacks it touched. Outside, every push is also a star in that day's
 * constellation. New pushes grow in live.
 */
export function Greenhouse({ initialPushes, todayDoor }: Props) {
  const { pushes, fresh } = useLivePushes(initialPushes);
  const byDoor = pushesByDoor(pushes);
  const total = [...byDoor.values()].reduce((a, l) => a + l.length, 0);
  const [hover, setHover] = useState<Hover>(null);
  const used = ALL_KINDS.filter((k) => k !== "other" && pushes.some((p) => (p.files?.[k] ?? 0) > 0));
  const unknown = pushes.some((p) => !mainKind(p.files));

  const card = (L: Layout): ReactNode =>
    hover?.layout === L.id ? (
      <motion.div
        key={`${hover.push.delivery_id}-${hover.what}`}
        className="kraft pointer-events-none absolute z-20 w-max max-w-60 px-3.5 py-2.5 shadow-[0_12px_26px_-12px_rgba(0,0,0,0.65)]"
        style={{ left: `${(hover.x / L.w) * 100}%`, top: `${(hover.y / L.h) * 100}%`, x: hover.x < L.w * 0.2 ? "-10%" : hover.x > L.w * 0.8 ? "-90%" : "-50%", y: "calc(-100% - 8px)" }}
        initial={{ opacity: 0, rotate: -4, y: "calc(-100% + 4px)" }}
        animate={{ opacity: 1, rotate: -1.5, y: "calc(-100% - 8px)", transition: springs.bouncy }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
      >
        <p className="font-hand text-base leading-none">
          door {hover.door} · {hover.what === "star" ? "a star" : "a stem"} · {new Date(hover.push.pushed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
        </p>
        <p className="mt-1 font-serif text-[15px] leading-tight italic">{commitTitle(hover.push)}</p>
        {hover.push.files && Object.keys(hover.push.files).length > 0 ? (
          <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 font-hand text-sm leading-none">
            {ALL_KINDS.filter((k) => (hover.push.files?.[k] ?? 0) > 0).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full border border-kraft-ink/40" style={{ background: KINDS[k].tint }} />
                {hover.push.files![k]} {KINDS[k].label}
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-1 font-hand text-sm leading-none opacity-75">{hover.push.repo ?? "push"}</p>
        )}
      </motion.div>
    ) : null;

  return (
    <div className="relative min-h-dvh overflow-hidden px-3 pt-40 pb-12 text-paper sm:px-8 sm:pt-28" style={{ background: "linear-gradient(180deg, #1C1840 0%, #352D64 55%, #554784 100%)" }}>
      <div className="relative mx-auto max-w-6xl">
        <h2 className="font-serif text-3xl italic sm:text-4xl">the living garden</h2>
        <p className="mt-1 font-hand text-lg opacity-85 sm:text-xl">every push grows a stem inside and a star outside · {total} so far</p>

        <div className="relative mt-2 hidden md:block">
          <Scene L={WIDE} byDoor={byDoor} fresh={fresh} todayDoor={todayDoor} setHover={setHover} />
          <AnimatePresence>{card(WIDE)}</AnimatePresence>
        </div>
        <div className="relative mt-4 md:hidden">
          <Scene L={TALL} byDoor={byDoor} fresh={fresh} todayDoor={todayDoor} setHover={setHover} />
          <AnimatePresence>{card(TALL)}</AnimatePresence>
        </div>

        {/* key: only the stacks that actually appear */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-hand text-lg">
          <span className="font-serif text-base italic opacity-80">key</span>
          {used.map((k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span className="inline-block size-4 rounded-full border border-paper/50" style={{ background: `linear-gradient(0deg, ${KINDS[k].tint} 55%, #FFFBF8)` }} />
              {KINDS[k].label}
            </span>
          ))}
          {unknown && (
            <span className="inline-flex items-center gap-2 opacity-75">
              <span className="inline-block size-4 rounded-full border border-paper/50" style={{ background: KINDS.other.tint }} />
              file types not recorded
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
