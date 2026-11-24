"use client";

import { useEffect, useRef, useState } from "react";
import { VIEW_H, VIEW_W } from "@/lib/building";
import { anchors, constellation, constellationRadius, starPath } from "@/lib/constellations";
import { commitTitle, pushesByDoor, type PushRow } from "@/lib/pushes";
import type { SkyPhase } from "@/lib/sky";

type Props = { pushes: PushRow[]; fresh: Set<string>; isPhone: boolean; phase: SkyPhase; todayDoor: number | null; built: boolean };

/**
 * Every push is a star; every day's pushes join up into that door's
 * constellation. Drawn in building units with overflow visible, so the sky
 * moves with the building's zoom and parallax.
 */
export function Constellations({ pushes, fresh, isPhone, phase, todayDoor, built }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [side, setSide] = useState(260);
  const [hover, setHover] = useState<{ x: number; y: number; push: PushRow; door: number } | null>(null);

  // How much sky is free on each side of the building, in building units.
  useEffect(() => {
    const measure = () => {
      const w = ref.current?.getBoundingClientRect().width;
      if (w) setSide(Math.max(90, Math.min(360, ((innerWidth - w) / 2) * (VIEW_W / w))));
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, []);

  const night = phase === "night" || phase === "dusk";
  const ink = night ? "#FBF1EE" : "var(--color-line)";
  const spots = anchors(isPhone, side);
  const radius = constellationRadius(isPhone, side);
  const groups = [...pushesByDoor(pushes).entries()].map(([door, list]) => constellation(door, list, spots[door], radius));

  return (
    <>
      <svg
        ref={ref}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        style={{ opacity: built ? (night ? 1 : 0.7) : 0, transition: "opacity 1.2s" }}
        aria-hidden
      >
        <defs>
          <radialGradient id="star-glow">
            <stop offset="0" stopColor={night ? "#FFF6E0" : "#FBE3B0"} stopOpacity={night ? 0.8 : 0.6} />
            <stop offset="1" stopColor={night ? "#FFF6E0" : "#FBE3B0"} stopOpacity="0" />
          </radialGradient>
        </defs>
        {groups.map((c) => (
          <g key={c.door} className="constellation-drift" style={{ animationDelay: `${-c.door * 2.3}s`, animationDuration: `${16 + (c.door % 4) * 3}s` }}>
            {c.stars.slice(1).map((s, i) => {
              const a = c.stars[i];
              const isNew = fresh.has(s.push.delivery_id);
              return (
                <line
                  key={s.push.delivery_id}
                  x1={a.x}
                  y1={a.y}
                  x2={s.x}
                  y2={s.y}
                  stroke={ink}
                  strokeWidth={0.9}
                  strokeOpacity={0.55}
                  pathLength={1}
                  strokeDasharray={1}
                  className={isNew ? "star-line-in" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {c.stars.map((s, i) => {
              const isNew = fresh.has(s.push.delivery_id);
              return (
                <g key={s.push.delivery_id} transform={`translate(${s.x} ${s.y})`}>
                  <g className={isNew ? "star-in" : "star-twinkle"} style={{ animationDelay: isNew ? "0.6s" : `${-((i * 1.7 + c.door) % 5)}s` }}>
                    <circle r={s.size * 3.2} fill="url(#star-glow)" />
                    <path d={starPath(s.size * 1.15)} fill={ink} />
                  </g>
                  <circle
                    r={11}
                    fill="transparent"
                    className="pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setHover({ x: s.x, y: s.y, push: s.push, door: c.door })}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
            <text x={c.label.x} y={c.label.y} textAnchor="middle" className="font-sans uppercase" fontSize={isPhone ? 9 : 10} letterSpacing={1.6} fontWeight={500} fill={ink} fillOpacity={0.6}>
              {c.door === 0 ? "No. 0 · foundation" : `No. ${c.door}${c.door === todayDoor ? " · today" : ""}`}
            </text>
          </g>
        ))}
        {/* the odd shooting star, only after dark */}
        {night && (
          <g stroke="#FFF6E0" strokeWidth={1.6} strokeLinecap="round" fill="none">
            <path d={isPhone ? "M40 -230 L190 -170" : "M-260 60 L-60 150"} pathLength={1} className="shooting-star" vectorEffect="non-scaling-stroke" />
            <path d={isPhone ? "M460 -150 L330 -90" : "M760 40 L560 140"} pathLength={1} className="shooting-star" style={{ animationDelay: "6.5s" }} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>

      {/* commit card for the hovered star, positioned in building units (%) so it sticks to the star */}
      {hover && (
          <div
            className="card-in pointer-events-none absolute z-40 w-max max-w-60 rounded-md border border-line/25 bg-paper px-3.5 py-2.5 text-line shadow-[0_12px_32px_-12px_rgba(78,30,40,0.35)]"
            style={{ left: `${(hover.x / VIEW_W) * 100}%`, top: `${(hover.y / VIEW_H) * 100}%`, translate: `${hover.x < 0 ? "0%" : "-50%"} calc(-100% - 14px)` }}
          >
            <p className="font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70">
              No. {hover.door} · {hover.push.repo ?? "push"}
            </p>
            <p className="mt-1 font-serif text-[15px] leading-snug">{commitTitle(hover.push)}</p>
            {hover.push.sha && <p className="mt-1 font-mono text-[11px] opacity-60">{hover.push.sha.slice(0, 7)}</p>}
          </div>
        )}
    </>
  );
}
