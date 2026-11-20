"use client";

import { useEffect, useRef, useState } from "react";
import type { Theme } from "@/lib/records/paint.ts";
import type { Song } from "@/lib/records/songs";
import { RecordDisc } from "./RecordDisc";

/**
 * A fine-line turntable. The platter has inertia: it eases up to 33⅓ rpm
 * when the music plays and coasts down when it stops (a first-order lag,
 * dω/dt = k·(target − ω)), so it never snaps. The tonearm swings from its
 * rest to the outer groove, then creeps inward with the song's progress,
 * exactly like a stylus riding a spiral groove.
 */

const VIEW = { w: 600, h: 440 };
const PLATTER = { x: 250, y: 220, r: 178 };
const PIVOT = { x: 500, y: 76 };
const ARM = 250;
const RPM = 100 / 3; // 33⅓
/** Arm angle (degrees, clockwise from straight down): rest, outer groove, inner groove. */
const REST = -3;
const OUTER = 25.5;
const INNER = 39;

export function Turntable({ song, birthday, theme, playing, progress }: { song: Song | null; birthday: string; theme: Theme; playing: boolean; progress: number }) {
  const [angle, setAngle] = useState(0);
  const omega = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const target = playing ? (RPM / 60) * 360 : 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      omega.current += (target - omega.current) * Math.min(1, dt * (playing ? 1.8 : 0.9));
      if (Math.abs(omega.current) > 0.05 || playing) {
        setAngle((a) => (a + omega.current * dt) % 360);
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const arm = song && (playing || progress > 0) ? OUTER + (INNER - OUTER) * Math.min(1, Math.max(0, progress)) : REST;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const disc = PLATTER.r * 0.96 * 2;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="var(--color-line)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          <rect x={20} y={20} width={560} height={400} rx={18} fill="var(--color-paper)" />
          <rect x={30} y={30} width={540} height={380} rx={12} opacity={0.35} />
          <circle cx={PLATTER.x} cy={PLATTER.y} r={PLATTER.r + 6} fill="var(--color-glass)" />
          <circle cx={PLATTER.x} cy={PLATTER.y} r={PLATTER.r} />
          {/* speed knob and power light */}
          <circle cx={520} cy={370} r={16} fill="var(--color-paper)" />
          <path d="M520 358 V366" />
          <circle cx={470} cy={372} r={4} fill={playing ? "#F2C45A" : "var(--color-paper)"} style={{ transition: "fill .4s" }} />
        </g>
        <text x={520} y={404} textAnchor="middle" className="font-sans" fontSize={11} letterSpacing={1} fill="var(--color-line)" opacity={0.7}>
          33⅓
        </text>
      </svg>

      {/* the record */}
      <div className="absolute flex items-center justify-center" style={{ left: pct(PLATTER.x - disc / 2, VIEW.w), top: pct(PLATTER.y - disc / 2, VIEW.h), width: pct(disc, VIEW.w), aspectRatio: "1" }}>
        {song ? (
          <DiscSized song={song} birthday={birthday} theme={theme} angle={angle} />
        ) : (
          <p className="max-w-40 text-center font-sans text-xs opacity-60">Pick a record from the crate</p>
        )}
      </div>

      {/* tonearm, above the record */}
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="var(--color-line)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={PIVOT.x} cy={PIVOT.y} r={22} fill="var(--color-paper)" />
          <circle cx={PIVOT.x} cy={PIVOT.y} r={8} fill="var(--color-glass)" />
          <g style={{ transform: `rotate(${arm}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`, transition: "transform 1.1s cubic-bezier(.3,.8,.3,1)" }}>
            <path d={`M${PIVOT.x} ${PIVOT.y} V${PIVOT.y + ARM - 30} L${PIVOT.x - 10} ${PIVOT.y + ARM - 8}`} strokeWidth={3} />
            <rect x={PIVOT.x - 22} y={PIVOT.y + ARM - 12} width={22} height={16} rx={3} fill="var(--color-paper)" transform={`rotate(-18 ${PIVOT.x - 11} ${PIVOT.y + ARM - 4})`} />
            <rect x={PIVOT.x - 7} y={PIVOT.y - 44} width={14} height={20} rx={3} fill="var(--color-paper)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/** The disc fills its slot; measure the slot so the canvas is drawn at the right resolution. */
function DiscSized({ song, birthday, theme, angle }: { song: Song; birthday: string; theme: Theme; angle: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="h-full w-full drop-shadow-[0_6px_10px_rgba(78,30,40,0.25)]">
      {size > 0 && <RecordDisc song={song} birthday={birthday} theme={theme} size={size} angle={angle} />}
    </div>
  );
}
