"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { useLivePushes } from "@/components/building/useLivePushes";
import { constellation, starPath } from "@/lib/constellations";
import { KINDS, mainKind, type FileKind } from "@/lib/file-kinds";
import { commitTitle, pushesByDoor, seeded, type PushRow } from "@/lib/pushes";

type Props = { initialPushes: PushRow[]; todayDoor: number | null };

const INK = "#9E3B4C";
const PAPER = "#FBF1EE";
const NO_KIND_TINT = "#F1DCE2";
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Everything that differs between the wide (desktop) and tall (phone) greenhouse. */
type Layout = {
  id: string;
  w: number;
  h: number;
  ground: number;
  dome: { x0: number; x1: number; wallTop: number; top: number };
  /** benches: y of the top plank, and which doors' pots stand on it */
  benches: { y: number; x0: number; x1: number; doors: number[]; ceiling?: number }[];
  pot: number; // pot width
  maxLean: number;
  head: number;
  stars: [number, number][];
  starRadius: number;
};

const WIDE: Layout = {
  id: "wide",
  w: 1000,
  h: 640,
  ground: 590,
  dome: { x0: 170, x1: 830, wallTop: 400, top: 120 },
  benches: [{ y: 556, x0: 196, x1: 804, doors: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }],
  pot: 24,
  maxLean: 13,
  head: 8.5,
  stars: [
    [80, 120], [920, 120], [250, 62], [750, 62], [80, 270], [920, 270],
    [400, 30], [600, 30], [80, 420], [920, 420], [80, 540], [920, 540],
  ],
  starRadius: 32,
};

const TALL: Layout = {
  id: "tall",
  w: 520,
  h: 960,
  ground: 910,
  dome: { x0: 22, x1: 498, wallTop: 650, top: 330 },
  benches: [
    { y: 640, x0: 48, x1: 472, doors: [0, 1, 2, 3, 4, 5] },
    { y: 876, x0: 40, x1: 480, doors: [6, 7, 8, 9, 10, 11], ceiling: 664 },
  ],
  pot: 26,
  maxLean: 16,
  head: 8.5,
  stars: [
    [70, 60], [190, 60], [330, 60], [450, 60],
    [70, 160], [190, 160], [330, 160], [450, 160],
    [70, 255], [190, 250], [330, 250], [450, 255],
  ],
  starRadius: 26,
};

/** Top of the glass at x (the dome's curve, or the wall below it). */
function glassTop(L: Layout, x: number): number {
  const { x0, x1, wallTop, top } = L.dome;
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const k = Math.min(1, Math.abs(x - cx) / rx);
  return wallTop - (wallTop - top) * Math.sqrt(1 - k * k);
}

type Stem = { push: PushRow; door: number; d: string; leaf: string; hx: number; hy: number; kind: "daisy" | "tulip" | "bud"; tint: string; fileKind: FileKind | null };

/**
 * Lay out one pot's stems. Stem 0 stands in the middle; the rest alternate
 * left/right, leaning a little further and growing a little shorter, so the
 * pot fills out like a real plant. Every stem stays within `maxLean` of the
 * pot's centre and below the glass, so neighbouring pots never collide.
 */
function stemsFor(L: Layout, door: number, x: number, potTop: number, list: PushRow[], ceiling: number): Stem[] {
  // Check the glass at the furthest point a stem can lean to (not just above
  // the pot's centre): near the walls the dome curves down over the outer stems.
  const reach = L.maxLean + L.head;
  const glass = Math.max(glassTop(L, x - reach), glassTop(L, x), glassTop(L, x + reach));
  const avail = Math.max(40, potTop - Math.max(ceiling, glass + 22));
  const sides = Math.max(1, Math.ceil((list.length - 1) / 2));
  return list.map((push, i) => {
    const r = seeded(push.sha ?? push.delivery_id);
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    const lean = r1((side / sides) * L.maxLean + (r() - 0.5) * 3);
    // busier days grow taller plants (but never into the glass): 1 push ≈ 90, 6+ pushes ≈ 170
    const target = 80 + 16 * Math.min(list.length, 6);
    const h = r1(Math.min(avail, target * (1 - 0.12 * Math.abs(side)) + r() * 12));
    const hx = r1(x + lean);
    const hy = r1(potTop - h);
    const d = `M${x} ${potTop} Q${r1(x + lean * 0.15)} ${r1(potTop - h * 0.55)} ${hx} ${hy}`;
    const ly = r1(potTop - h * (0.35 + r() * 0.15));
    const lx = r1(x + lean * 0.3);
    const s = side === 0 ? (r() < 0.5 ? -1 : 1) : Math.sign(side);
    const ly2 = r1(potTop - h * (0.62 + r() * 0.1));
    const lx2 = r1(x + lean * 0.55);
    // two leaves on opposite sides of the stem
    const leaf = `M${lx} ${ly} q${s * 7} -6 ${s * 12} -2 q${-s * 5} 4 ${-s * 12} 2 M${lx2} ${ly2} q${-s * 6} -5 ${-s * 10} -1.5 q${s * 4} 3.5 ${s * 10} 1.5`;
    const kind = (["daisy", "tulip", "bud"] as const)[Math.floor(r() * 3)];
    const fk = mainKind(push.files);
    return { push, door, d, leaf, hx, hy, kind, tint: fk ? KINDS[fk].tint : NO_KIND_TINT, fileKind: fk };
  });
}

const PETALS = [[0, -1], [0.951, -0.309], [0.588, 0.809], [-0.588, 0.809], [-0.951, -0.309]] as const;

function FlowerHead({ s, size, fresh }: { s: Stem; size: number; fresh: boolean }) {
  const common = { fill: s.tint, stroke: INK, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" as const, className: fresh ? "head-in" : undefined };
  const { hx: x, hy: y } = s;
  if (s.kind === "tulip") {
    const z = size;
    return <path {...common} strokeLinejoin="round" d={`M${r1(x - z * 0.8)} ${y} L${r1(x - z * 0.8)} ${r1(y - z)} L${r1(x - z * 0.3)} ${r1(y - z * 0.5)} L${x} ${r1(y - z * 1.2)} L${r1(x + z * 0.3)} ${r1(y - z * 0.5)} L${r1(x + z * 0.8)} ${r1(y - z)} L${r1(x + z * 0.8)} ${y} Q${x} ${r1(y + z * 0.75)} ${r1(x - z * 0.8)} ${y}Z`} />;
  }
  if (s.kind === "bud") {
    return <path {...common} d={`M${x} ${r1(y + size * 0.4)} q${-size * 0.8} ${-size * 0.8} 0 ${-size * 1.7} q${size * 0.8} ${size * 0.9} 0 ${size * 1.7}`} />;
  }
  return (
    <g className={fresh ? "head-in" : undefined}>
      {PETALS.map(([a, b]) => (
        <circle key={a} cx={r1(x + a * size * 0.62)} cy={r1(y + b * size * 0.62)} r={r1(size * 0.48)} fill={s.tint} stroke={INK} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
      ))}
      <circle cx={x} cy={y} r={r1(size * 0.3)} fill="#F6D27A" stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

type Hover = { layout: string; x: number; y: number; push: PushRow; door: number; what: "stem" | "star" } | null;

function Scene({ L, byDoor, fresh, todayDoor, hover, setHover }: { L: Layout; byDoor: Map<number, PushRow[]>; fresh: Set<string>; todayDoor: number | null; hover: Hover; setHover: (h: Hover) => void }) {
  const { x0, x1, wallTop, top } = L.dome;
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = wallTop - top;
  const outline = `M${x0} ${L.ground} V${wallTop} A${rx} ${ry} 0 0 1 ${x1} ${wallTop} V${L.ground}`;
  // vertical glazing bars that curve in to meet at the finial
  const ribs = [-0.66, -0.33, 0, 0.33, 0.66].map((k) => `M${r1(cx + rx * k)} ${L.ground} V${wallTop} Q${r1(cx + rx * k * 0.6)} ${r1(top + ry * 0.12)} ${cx} ${top}`);
  // horizontal rings across the dome
  const rings = [0.3, 0.58, 0.82].map((k) => {
    const half = rx * Math.sqrt(1 - k * k);
    return `M${r1(cx - half)} ${r1(wallTop - ry * k)} H${r1(cx + half)}`;
  });
  const pots = L.benches.flatMap((b) =>
    b.doors.map((door, i) => {
      const x = r1(b.x0 + 26 + (i * (b.x1 - b.x0 - 52)) / (b.doors.length - 1));
      return { door, x, bench: b };
    }),
  );
  const glowId = `glow-${L.id}`;
  const lightId = `light-${L.id}`;

  return (
    <svg viewBox={`0 0 ${L.w} ${L.h}`} className="block h-auto w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={lightId} cx="50%" cy="78%" r="70%">
          <stop offset="0" stopColor="#FFF3D9" />
          <stop offset="0.7" stopColor="#FBEDE6" />
          <stop offset="1" stopColor="#F2E0DC" />
        </radialGradient>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="#FFF6E0" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFF6E0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── sky: one constellation per door, outside the glass ── */}
      {[...byDoor.entries()].map(([door, list]) => {
        const c = constellation(door, list, L.stars[door], L.starRadius);
        return (
          <g key={door}>
            {c.stars.slice(1).map((s, i) => (
              <line key={s.push.delivery_id} x1={c.stars[i].x} y1={c.stars[i].y} x2={s.x} y2={s.y} stroke={PAPER} strokeOpacity={0.5} strokeWidth={1} pathLength={1} strokeDasharray={1} className={fresh.has(s.push.delivery_id) ? "star-line-in" : undefined} vectorEffect="non-scaling-stroke" />
            ))}
            {c.stars.map((s, i) => (
              <g key={s.push.delivery_id} transform={`translate(${s.x} ${s.y})`}>
                <g className={fresh.has(s.push.delivery_id) ? "star-in" : "star-twinkle"} style={{ animationDelay: `${-((i * 1.3 + door) % 4)}s` }}>
                  <circle r={s.size * 3.4} fill={`url(#${glowId})`} />
                  <path d={starPath(s.size * 1.2)} fill={PAPER} />
                </g>
                <circle r={11} fill="transparent" className="pointer-events-auto cursor-pointer" onMouseEnter={() => setHover({ layout: L.id, x: s.x, y: s.y, push: s.push, door, what: "star" })} onMouseLeave={() => setHover(null)} />
              </g>
            ))}
            <text x={L.stars[door][0]} y={L.stars[door][1] + L.starRadius * 0.7 + 16} textAnchor="middle" className="font-hand" fontSize={L.id === "wide" ? 15 : 14} fill={PAPER} fillOpacity={0.7}>
              {door === 0 ? "door 0" : `door ${door}`}
              {door === todayDoor ? " · today" : ""}
            </text>
          </g>
        );
      })}

      {/* ── ground ── */}
      <path d={`M-500 ${L.ground} H${L.w + 500}`} stroke={PAPER} strokeOpacity={0.4} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />

      {/* ── the greenhouse: lit glass, then frame ── */}
      <path d={`${outline} Z`} fill={`url(#${lightId})`} />
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {ribs.map((d) => (
          <path key={d} d={d} strokeOpacity={0.45} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        ))}
        {rings.map((d) => (
          <path key={d} d={d} strokeOpacity={0.4} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`M${x0} ${wallTop} H${x1}`} strokeOpacity={0.7} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        {/* glints on the glass */}
        {[[x0 + 40, wallTop + 40], [x1 - 70, wallTop + 60], [cx - rx * 0.4, top + ry * 0.35], [cx + rx * 0.25, top + ry * 0.2]].map(([gx, gy]) => (
          <path key={`${gx}`} d={`M${r1(gx)} ${r1(gy)} l12 -12 M${r1(gx + 5)} ${r1(gy + 5)} l9 -9`} strokeOpacity={0.3} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* ── benches ── */}
      <g fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke">
        {L.benches.map((b) => (
          <path key={b.y} d={`M${b.x0} ${b.y} H${b.x1} M${b.x0} ${b.y + 7} H${b.x1} M${b.x0 + 8} ${b.y + 7} V${Math.min(L.ground, b.y + 34)} M${b.x1 - 8} ${b.y + 7} V${Math.min(L.ground, b.y + 34)}`} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* ── pots, and every push as a stem in its day's pot ── */}
      {pots.map(({ door, x, bench }) => {
        const potTop = bench.y - 22;
        const list = byDoor.get(door) ?? [];
        const stems = stemsFor(L, door, x, potTop, list, bench.ceiling ?? 0);
        const isToday = door === todayDoor;
        const half = L.pot / 2;
        return (
          <g key={door}>
            {stems.map((s) => {
              const isFresh = fresh.has(s.push.delivery_id);
              return (
                <g key={s.push.delivery_id}>
                  <path d={s.d} fill="none" stroke="#6F9F6B" strokeWidth={1.3} strokeLinecap="round" pathLength={1} strokeDasharray={1} className={isFresh ? "stem-in" : undefined} vectorEffect="non-scaling-stroke" />
                  <path d={s.leaf} fill="#DCEBD3" stroke="#6F9F6B" strokeWidth={1.1} strokeLinejoin="round" className={isFresh ? "head-in" : undefined} vectorEffect="non-scaling-stroke" />
                  <FlowerHead s={s} size={L.head} fresh={isFresh} />
                  <rect
                    x={s.hx - 10}
                    y={s.hy - 12}
                    width={20}
                    height={22}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHover({ layout: L.id, x: s.hx, y: s.hy - 10, push: s.push, door, what: "stem" })}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
            {/* the pot sits in front of its stems */}
            <path d={`M${r1(x - half)} ${potTop + 4} L${r1(x - half + 3)} ${bench.y} H${r1(x + half - 3)} L${r1(x + half)} ${potTop + 4} Z`} fill={PAPER} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${r1(x - half - 2)} ${potTop} H${r1(x + half + 2)} V${potTop + 4} H${r1(x - half - 2)} Z`} fill={isToday ? "#FBE3B0" : PAPER} stroke={INK} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
            <text x={x} y={bench.y - 5} textAnchor="middle" className="font-hand" fontSize={11} fill={INK}>
              {door}
            </text>
          </g>
        );
      })}

      {/* finial */}
      <path d={`M${cx} ${top} V${top - 16} M${cx - 5} ${top - 10} L${cx} ${top - 18} L${cx + 5} ${top - 10}`} fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={outline} fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

    </svg>
  );
}

/**
 * Door 1 · the living garden. A fine-line greenhouse at night. Inside, one pot
 * per door: every push grows a new stem in its day's pot, its flower tinted by
 * the tech stack it touched. Outside, every push is also a star in that day's
 * constellation. New pushes grow in live.
 */
export function Greenhouse({ initialPushes, todayDoor }: Props) {
  const { pushes, fresh } = useLivePushes(initialPushes);
  const byDoor = pushesByDoor(pushes);
  const total = [...byDoor.values()].reduce((a, l) => a + l.length, 0);
  const [hover, setHover] = useState<Hover>(null);
  const used = (Object.keys(KINDS) as FileKind[]).filter((k) => pushes.some((p) => mainKind(p.files) === k));
  const unknown = pushes.some((p) => !mainKind(p.files));

  const card = (L: Layout) =>
    hover?.layout === L.id ? (
      <motion.div
        key={`${hover.push.delivery_id}-${hover.what}`}
        className="kraft pointer-events-none absolute z-20 w-max max-w-56 px-3 py-2 shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)]"
        style={{ left: `${(hover.x / L.w) * 100}%`, top: `${(hover.y / L.h) * 100}%`, x: hover.x < L.w * 0.2 ? "-10%" : hover.x > L.w * 0.8 ? "-90%" : "-50%", y: "calc(-100% - 10px)" }}
        initial={{ opacity: 0, rotate: -4 }}
        animate={{ opacity: 1, rotate: -1.5, transition: springs.bouncy }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
      >
        <p className="font-hand text-base leading-none">
          door {hover.door} · {hover.what === "star" ? "a star" : "a stem"} · {new Date(hover.push.pushed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
        </p>
        <p className="mt-1 font-serif text-sm leading-tight italic">{commitTitle(hover.push)}</p>
        <p className="mt-1 font-hand text-sm leading-none opacity-80">
          {hover.push.repo ?? "push"}
          {mainKind(hover.push.files) ? ` · mostly ${KINDS[mainKind(hover.push.files)!].label}` : ""}
        </p>
      </motion.div>
    ) : null;

  return (
    <div className="relative min-h-dvh overflow-hidden px-3 pt-40 pb-12 text-paper sm:px-8 sm:pt-28" style={{ background: "linear-gradient(180deg, #1E1A40 0%, #3A3168 60%, #5A4C88 100%)" }}>
      <div className="relative mx-auto max-w-5xl">
        <h2 className="font-serif text-3xl italic sm:text-4xl">the living garden</h2>
        <p className="mt-1 font-hand text-lg opacity-85 sm:text-xl">
          every push grows a stem inside and a star outside · {total} so far
        </p>

        <div className="relative mt-4 hidden md:block">
          <Scene L={WIDE} byDoor={byDoor} fresh={fresh} todayDoor={todayDoor} hover={hover} setHover={setHover} />
          <AnimatePresence>{card(WIDE)}</AnimatePresence>
        </div>
        <div className="relative mt-4 md:hidden">
          <Scene L={TALL} byDoor={byDoor} fresh={fresh} todayDoor={todayDoor} hover={hover} setHover={setHover} />
          <AnimatePresence>{card(TALL)}</AnimatePresence>
        </div>

        {/* key: only the stacks that actually appear */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-hand text-lg">
          <span className="font-serif text-base italic opacity-80">key</span>
          {used.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-3.5 rounded-full border border-paper/60" style={{ background: KINDS[k].tint }} />
              {KINDS[k].label}
            </span>
          ))}
          {unknown && (
            <span className="inline-flex items-center gap-1.5 opacity-80">
              <span className="inline-block size-3.5 rounded-full border border-paper/60" style={{ background: NO_KIND_TINT }} />
              before file types were tracked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
