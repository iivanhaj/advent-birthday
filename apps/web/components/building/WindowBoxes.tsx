"use client";

import { FRONT_DOOR, VIEW_H, VIEW_W, WINDOWS } from "@/lib/building";
import { pushesByDoor, seeded, type PushRow } from "@/lib/pushes";

/**
 * Where each door's flowers grow, in building units (the 480 × 720 grid).
 * Windows: along the top of their sill. Door 0 (Nov 17, the foundation): under
 * the shop window. The front door has no sill, so it gets two pots on the
 * pavement, one either side.
 */
type Bed = { x0: number; x1: number; y: number }[];
const BEDS: Record<number, Bed> = Object.fromEntries([
  ...WINDOWS.filter((w) => w.n !== FRONT_DOOR).map((w) => [w.n, [{ x0: w.x - w.w * 0.06 + 5, x1: w.x + w.w * 1.06 - 5, y: w.y + w.h }]]),
  [FRONT_DOOR, [{ x0: 197, x1: 207, y: 690 }, { x0: 281, x1: 291, y: 690 }]],
  [0, [{ x0: 300, x1: 416, y: 670 }]],
]);
/** The extra shapes some beds need (a box for door 0, pots for the front door). */
const BED_SHAPES = [
  "M294 670 H422 L419 682 H297 Z", // shop window box
  "M193 690 H211 L208 700 H196 Z", // pot left of the front door
  "M277 690 H295 L292 700 H280 Z", // pot right of the front door
];

const PETALS = [[0, -1], [0.951, -0.309], [0.588, 0.809], [-0.588, 0.809], [-0.951, -0.309]] as const;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One tiny fine-line flower per push, in the window box of the day it landed.
 * Spot, height and lean come from the commit SHA (seeded), so a push always
 * blooms in the same place. Pushes that arrived while you watch pop in.
 */
export function WindowBoxes({ pushes, fresh, built }: { pushes: PushRow[]; fresh: Set<string>; built: boolean }) {
  const byDoor = pushesByDoor(pushes);
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 z-[8] h-full w-full overflow-visible" aria-hidden>
      <g style={{ opacity: built ? 1 : 0, transition: "opacity 0.8s" }}>
        {BED_SHAPES.map((d) => (
          <path key={d} d={d} fill="var(--color-paper)" stroke="var(--color-line)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {[...byDoor.entries()].map(([door, list]) => {
          const beds = BEDS[door];
          if (!beds) return null;
          return list.map((p, i) => {
            const bed = beds[i % beds.length];
            const r = seeded(p.sha ?? p.delivery_id);
            // spread flowers across the bed, filling it evenly before doubling up
            const slots = Math.max(1, Math.floor((bed.x1 - bed.x0) / 9));
            const slot = (Math.floor(i / beds.length) * 5) % (slots + 1);
            const x = r1(bed.x0 + (slots ? (slot / slots) * (bed.x1 - bed.x0) : (bed.x1 - bed.x0) / 2) + (r() - 0.5) * 3);
            const h = r1(9 + r() * 8 + (Math.floor(i / (slots + 1)) % 2) * 4);
            const lean = r1((r() - 0.5) * 5);
            const hx = r1(x + lean);
            const hy = r1(bed.y - h);
            const isFresh = fresh.has(p.delivery_id);
            return (
              <g
                key={p.delivery_id}
                className={isFresh ? "bloom-in" : "flower-sway"}
                style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animationDelay: isFresh ? "0.3s" : `${-r() * 6}s` }}
              >
                <path d={`M${x} ${bed.y} q${r1(lean * 0.3)} ${r1(-h * 0.6)} ${lean} ${-h}`} fill="none" stroke="#6F9F6B" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={`M${x} ${r1(bed.y - h * 0.45)} q4 -3 6.5 -0.5`} fill="none" stroke="#6F9F6B" strokeWidth={1.1} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {PETALS.map(([a, b]) => (
                  <circle key={a} cx={r1(hx + a * 3)} cy={r1(hy + b * 3)} r={2.2} fill="var(--color-paper)" stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ))}
                <circle cx={hx} cy={hy} r={1.5} fill="#F2C45A" />
              </g>
            );
          });
        })}
      </g>
    </svg>
  );
}
