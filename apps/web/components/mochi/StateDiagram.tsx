"use client";

import { useEffect, useRef, useState } from "react";
import { leafState, mochiMachine, type MochiState } from "@/lib/mochi/machine.ts";
import { useMochiSnapshot } from "./actor";

/**
 * Mochi's statechart, drawn live. The boxes are placed by hand, but the
 * arrows are read from the machine itself (every state node's transitions),
 * so the drawing can't drift from the code. The state she's in right now is
 * lit, and so is the arrow she just took.
 */

const POS: Record<MochiState, [number, number]> = {
  wander: [110, 80],
  sit: [110, 190],
  groom: [110, 300],
  idle: [290, 190],
  hungry: [290, 320],
  chase: [460, 80],
  watch: [620, 80],
  purr: [620, 190],
  toFood: [460, 300],
  eating: [620, 300],
  asleep: [760, 190],
};
const HW = 46;
const HH = 17;

const EVENT_LABEL: Record<string, string> = {
  CURSOR_MOVE: "cursor near",
  CURSOR_LEFT: "cursor gone",
  ARRIVED: "arrived",
  FOOD_GONE: "no food",
  PET: "pet",
};
const GUARD_LABEL: Record<string, string> = { hasFood: "food", isHungry: "hungry", isBored: "bored" };

type Edge = { from: MochiState; to: MochiState; label: string; timed: boolean; bend: number };

/** Read every transition out of the machine definition. */
function readEdges(): Edge[] {
  const out: Edge[] = [];
  const awake = mochiMachine.root.states.awake;
  const nodes = { ...awake.states, asleep: mochiMachine.root.states.asleep } as Record<string, (typeof awake.states)[string]>;
  for (const [name, node] of Object.entries(nodes)) {
    const from = name as MochiState;
    const defs = [...[...node.transitions.values()].flat().map((t) => ({ t, always: false })), ...(node.always ?? []).map((t) => ({ t, always: true }))];
    for (const { t, always } of defs) {
      const target = t.target?.[0];
      if (!target) continue;
      const to = target.key as MochiState;
      if (!(to in POS) || to === from) continue;
      const ev = String(t.eventType);
      const timed = ev.startsWith("xstate.after");
      const guard = typeof t.guard === "object" && t.guard && "type" in t.guard ? String(t.guard.type) : typeof t.guard === "string" ? t.guard : "";
      let label = timed ? "" : always ? (GUARD_LABEL[guard] ?? "") : (EVENT_LABEL[ev] ?? ev.toLowerCase());
      // "cursor near" leads to chase from several calm states; draw it from idle and watch only, and say so below.
      if (ev === "CURSOR_MOVE" && to === "chase" && from !== "idle" && from !== "watch") continue;
      if (out.some((e) => e.from === from && e.to === to)) continue;
      if (from === "asleep") label = "pet";
      if (from === "chase" && to === "idle") label = ""; // same "cursor gone" as watch → idle, which carries the label
      out.push({ from, to, label, timed: timed || always, bend: from === "idle" && to === "asleep" ? 70 : 16 });
    }
  }
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A curved arrow between two boxes, trimmed so it starts and ends at their edges. */
function geometry(e: Edge) {
  const [ax, ay] = POS[e.from];
  const [bx, by] = POS[e.to];
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const cx = mx + (-(by - ay) / len) * e.bend;
  const cy = my + ((bx - ax) / len) * e.bend;
  const trim = (px: number, py: number) => {
    const dx = cx - px;
    const dy = cy - py;
    const t = Math.min(HW / Math.abs(dx || 1e-6), HH / Math.abs(dy || 1e-6), 1) * 1.08;
    return [px + dx * t, py + dy * t];
  };
  const [sx, sy] = trim(ax, ay);
  const [ex, ey] = trim(bx, by);
  return {
    d: `M${r1(sx)} ${r1(sy)} Q${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}`,
    lx: r1(0.25 * sx + 0.5 * cx + 0.25 * ex),
    ly: r1(0.25 * sy + 0.5 * cy + 0.25 * ey),
  };
}

const EDGES = readEdges();

export function StateDiagram() {
  const snap = useMochiSnapshot();
  const state = snap ? leafState(snap.value) : null;
  const prev = useRef<MochiState | null>(null);
  const [lastEdge, setLastEdge] = useState<string | null>(null);
  useEffect(() => {
    if (!state) return;
    if (prev.current && prev.current !== state) setLastEdge(`${prev.current}>${state}`);
    prev.current = state;
  }, [state]);

  return (
    <svg viewBox="0 0 820 380" className="h-auto w-full" role="img" aria-label={`Mochi's statechart. She is in the ${state ?? "idle"} state.`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L9 5 L0 9" fill="none" stroke="var(--color-line)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      <rect x={40} y={30} width={650} height={330} rx={14} fill="none" stroke="var(--color-line)" strokeOpacity={0.35} strokeDasharray="4 5" />
      <text x={58} y={52} className="font-sans" fontSize={12} letterSpacing={1.6} fill="var(--color-line)" opacity={0.7}>
        AWAKE
      </text>
      {EDGES.map((e) => {
        const g = geometry(e);
        const hot = lastEdge === `${e.from}>${e.to}`;
        return (
          <g key={`${e.from}>${e.to}`} opacity={hot ? 1 : 0.5} style={{ transition: "opacity 0.4s" }}>
            <path d={g.d} fill="none" stroke="var(--color-line)" strokeWidth={hot ? 2 : 1.2} strokeDasharray={e.timed ? "3 4" : undefined} markerEnd="url(#arrow)" />
            {e.label && (
              <text x={g.lx} y={g.ly - 4} textAnchor="middle" className="font-sans" fontSize={13} fill="var(--color-line)" paintOrder="stroke" stroke="var(--color-paper)" strokeWidth={4}>
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {(Object.keys(POS) as MochiState[]).map((k) => {
        const [x, y] = POS[k];
        const on = k === state;
        return (
          <g key={k}>
            <rect x={x - HW} y={y - HH} width={HW * 2} height={HH * 2} rx={HH} fill={on ? "var(--color-glow)" : "var(--color-paper)"} stroke="var(--color-line)" strokeWidth={on ? 2 : 1.2} style={{ transition: "fill 0.3s" }} />
            <text x={x} y={y + 4} textAnchor="middle" className="font-sans" fontSize={14} fontWeight={on ? 600 : 400} fill="var(--color-line)">
              {k}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
