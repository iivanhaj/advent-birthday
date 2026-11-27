"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VIEW_H, VIEW_W, WINDOWS, awningStripes, buntingFlags, facadeDetails, facadeStrokes, windowOutline } from "@/lib/building";

/**
 * Door 10 · birthday eve. The building at night, and its lamps coming on one
 * window at a time from noon (India time), the last just before midnight. Tap a dark window to light it early. A countdown
 * runs to the 28th; once it arrives, the page points to door 11.
 */

const STROKES = facadeStrokes();
const DETAILS = facadeDetails();
const FLAGS = buntingFlags();
const STRIPES = awningStripes();
// the order the lamps come on: ground floor first, up to the roof
const ORDER = [...WINDOWS].sort((a, b) => b.y - a.y || a.x - b.x).map((w) => w.n);
const MIDNIGHT = Date.parse("2026-11-28T00:00:00+05:30");
const NOON = Date.parse("2026-11-27T12:00:00+05:30");

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0"));
}

export function EvePage() {
  const [now, setNow] = useState<number | null>(null);
  const [tapped, setTapped] = useState<Set<number>>(new Set());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const t = now ?? NOON;
  const arrived = t >= MIDNIGHT;
  const share = Math.min(1, Math.max(0, (t - NOON) / (MIDNIGHT - NOON)));
  const byClock = new Set(ORDER.slice(0, arrived ? ORDER.length : Math.floor(share * ORDER.length)));
  const lit = (n: number) => byClock.has(n) || tapped.has(n);
  const count = WINDOWS.filter((w) => lit(w.n)).length;
  const [h, m, s] = left(MIDNIGHT - t);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(180deg,#1c1838_0%,#2f2858_45%,#4a3f78_80%,#6b5a8e_100%)] px-4 pt-28 pb-16 text-[#fbf1ee] sm:px-10 sm:pt-32">
      <Stars />
      <div className="relative mx-auto grid max-w-5xl items-end gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="md:pb-24">
          <p className="font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70">Birthday eve</p>
          <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-5xl">{arrived ? "It's the twenty-eighth." : "The lamps are coming on."}</h2>
          <p className="mt-3 max-w-md font-sans text-sm leading-relaxed opacity-80 sm:text-[15px]">
            {arrived
              ? "Every window is lit. The last door is open."
              : "Since noon, the windows have been lighting up one at a time; the last comes on just before midnight. Tap a dark window if you can't wait."}
          </p>
          {arrived ? (
            <Link href="/door/11" className="mt-8 inline-block border border-[#fbf1ee]/70 px-5 py-2.5 font-sans text-[11px] font-medium tracking-[0.18em] uppercase hover:bg-[#fbf1ee]/10">
              Open door eleven
            </Link>
          ) : (
            <div className="mt-8" aria-live="off">
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-70">until the 28th, in India</p>
              <p className="mt-1 font-serif text-5xl tabular-nums sm:text-6xl">
                {h}
                <span className="opacity-50">:</span>
                {m}
                <span className="opacity-50">:</span>
                {s}
              </p>
              <p className="mt-3 font-serif text-sm italic opacity-75">
                {count} of {WINDOWS.length} windows lit
              </p>
            </div>
          )}
        </div>

        <svg viewBox={`0 -20 ${VIEW_W} ${VIEW_H + 40}`} className="w-full overflow-visible" role="img" aria-label={`The building at night, ${count} of ${WINDOWS.length} windows lit`}>
          <defs>
            <radialGradient id="eve-lamp" cx=".5" cy=".3" r=".8">
              <stop offset="0" stopColor="#fff1cc" />
              <stop offset=".55" stopColor="#fbd99a" />
              <stop offset="1" stopColor="#efb173" />
            </radialGradient>
            <radialGradient id="eve-glow">
              <stop offset="0" stopColor="#fbd99a" stopOpacity=".45" />
              <stop offset="1" stopColor="#fbd99a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M40 700 V92 H440 V700 Z M28 72 H452 V92 H28 Z M190 72 C190 30 290 30 290 72 Z M370 72 V36 H398 V72 Z M40 540 H440 L450 572 H30 Z" fill="#fbf1ee" />
          {STRIPES.map((d) => (
            <path key={d} d={d} fill="#9e3b4c" opacity={0.16} />
          ))}
          {FLAGS.map((d, i) => (
            <path key={d} d={d} fill={i % 2 ? "rgba(229,143,168,.4)" : "rgba(242,196,90,.45)"} />
          ))}
          {WINDOWS.map((w) => {
            const on = lit(w.n);
            return (
              <g key={w.n} onClick={() => setTapped((s) => new Set(s).add(w.n))} className={on ? "" : "cursor-pointer"}>
                {on && <ellipse cx={w.x + w.w / 2} cy={w.y + w.h / 2} rx={w.w * 1.1} ry={w.h * 0.9} fill="url(#eve-glow)" className="lamp-flicker" />}
                <path d={windowOutline(w)} fill={on ? "url(#eve-lamp)" : "#2b2548"} style={{ transition: "fill 1.2s" }} />
                {on && w.n !== 9 && <path d={`M${w.x + w.w / 2} ${w.y + (w.shape === "rect" ? 0 : w.w * 0.3)} V${w.y + w.h * 0.34} M${w.x + w.w / 2 - 6} ${w.y + w.h * 0.34} h12 l3 7 h-18 z`} fill="none" stroke="#9e3b4c" strokeWidth={1.2} />}
              </g>
            );
          })}
          <g fill="none" stroke="#9e3b4c" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            <path d={DETAILS.texture.join(" ")} strokeWidth={0.7} opacity={0.14} />
            <path d={STROKES.join(" ")} strokeWidth={1.5} />
            <path d={DETAILS.trim.join(" ")} strokeWidth={1} opacity={0.85} />
            {WINDOWS.map((w) => (
              <path key={w.n} d={windowOutline(w)} strokeWidth={1.5} />
            ))}
          </g>
          <path d="M-60 700 H540" stroke="#fbf1ee" strokeOpacity={0.5} strokeWidth={1.5} />
        </svg>
      </div>
    </div>
  );
}

/** A few hundred stars, placed by a seeded hash so the server and browser agree. */
function Stars() {
  const stars = Array.from({ length: 120 }, (_, i) => {
    const h = Math.imul(i + 1, 2654435761) >>> 0;
    return { x: (h % 1000) / 10, y: ((h >>> 10) % 700) / 10, r: 0.6 + ((h >>> 20) % 10) / 10, d: (h >>> 4) % 34 };
  });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <span key={i} className="sky-twinkle absolute rounded-full bg-[#fff6e6]" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `-${s.d / 10}s` }} />
      ))}
    </div>
  );
}
