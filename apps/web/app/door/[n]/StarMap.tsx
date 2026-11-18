"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { useLivePushes } from "@/components/building/useLivePushes";
import { constellation, starPath } from "@/lib/constellations";
import { DOOR_META } from "@/lib/doors";
import { commitTitle, pushesByDoor, seeded, type PushRow } from "@/lib/pushes";

type Props = { initialPushes: PushRow[]; todayDoor: number | null; dateLabels: Record<number, string> };

// A faint field of background stars, from integer hashing (identical on server and browser).
const DUST = Array.from({ length: 70 }, (_, i) => {
  const r = seeded(`dust-${i}`);
  return { x: Math.round(r() * 1000) / 10, y: Math.round(r() * 1000) / 10, s: Math.round((1 + r() * 1.6) * 10) / 10, o: Math.round((0.25 + r() * 0.45) * 100) / 100 };
});

/**
 * Door 1 · the full star map. Twelve cards, one per day of the countdown
 * (door 0 = the night the repo was born). Each card draws that day's pushes
 * as a constellation; hover a star for its commit. New pushes appear live.
 */
export function StarMap({ initialPushes, todayDoor, dateLabels }: Props) {
  const { pushes, fresh } = useLivePushes(initialPushes);
  const byDoor = pushesByDoor(pushes);
  const total = [...byDoor.values()].reduce((a, l) => a + l.length, 0);
  const [hover, setHover] = useState<{ door: number; x: number; y: number; push: PushRow } | null>(null);

  return (
    <div className="relative min-h-dvh overflow-hidden px-4 pt-40 pb-16 text-paper sm:px-10 sm:pt-28" style={{ background: "linear-gradient(180deg, #221E46 0%, #3A3168 55%, #5C4E8A 100%)" }}>
      {DUST.map((d, i) => (
        <span key={i} aria-hidden className="sky-twinkle absolute rounded-full bg-paper" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, opacity: d.o, animationDelay: `${(i % 7) * 0.5}s` }} />
      ))}

      <div className="relative mx-auto max-w-5xl">
        <h2 className="font-serif text-3xl italic sm:text-4xl">every push is a star</h2>
        <p className="mt-1 font-hand text-xl opacity-85">
          each day&apos;s pushes join into that door&apos;s constellation · {total} {total === 1 ? "star" : "stars"} so far
        </p>

        <ol className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, door) => {
            const list = byDoor.get(door) ?? [];
            const c = constellation(door, list, [100, 70], 70);
            const isToday = door === todayDoor;
            const future = todayDoor != null && door > todayDoor;
            const date = door === 0 ? "Tue, Nov 17" : dateLabels[door];
            return (
              <li
                key={door}
                className="relative rounded-2xl border px-2 pt-2 pb-3"
                style={{ borderColor: isToday ? "rgba(251,227,176,0.7)" : "rgba(251,241,238,0.18)", background: isToday ? "rgba(251,227,176,0.07)" : "rgba(251,241,238,0.03)" }}
              >
                <svg viewBox="0 0 200 150" className="w-full overflow-visible" aria-hidden>
                  <defs>
                    <radialGradient id={`glow-${door}`}>
                      <stop offset="0" stopColor="#FFF6E0" stopOpacity="0.8" />
                      <stop offset="1" stopColor="#FFF6E0" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {list.length === 0 && (
                    <circle cx={100} cy={70} r={34} fill="none" stroke="#FBF1EE" strokeOpacity={0.25} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
                  )}
                  {c.stars.slice(1).map((s, i) => (
                    <line
                      key={s.push.delivery_id}
                      x1={c.stars[i].x}
                      y1={c.stars[i].y}
                      x2={s.x}
                      y2={s.y}
                      stroke="#FBF1EE"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                      pathLength={1}
                      strokeDasharray={1}
                      className={fresh.has(s.push.delivery_id) ? "star-line-in" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {c.stars.map((s, i) => (
                    <g key={s.push.delivery_id} transform={`translate(${s.x} ${s.y})`}>
                      <g className={fresh.has(s.push.delivery_id) ? "star-in" : "star-twinkle"} style={{ animationDelay: `${-((i * 1.3 + door) % 4)}s` }}>
                        <circle r={s.size * 3.6} fill={`url(#glow-${door})`} />
                        <path d={starPath(s.size * 1.3)} fill="#FBF1EE" />
                      </g>
                      <circle
                        r={12}
                        fill="transparent"
                        className="cursor-pointer"
                        tabIndex={0}
                        role="img"
                        aria-label={`${commitTitle(s.push)} (${s.push.repo ?? "push"})`}
                        onMouseEnter={() => setHover({ door, x: s.x, y: s.y, push: s.push })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ door, x: s.x, y: s.y, push: s.push })}
                        onBlur={() => setHover(null)}
                      />
                    </g>
                  ))}
                </svg>
                <p className="px-2 font-hand text-lg leading-tight">
                  no. {door} · {door === 0 ? "the foundation" : DOOR_META[door].title}
                </p>
                <p className="px-2 font-hand text-base leading-tight opacity-70">
                  {date}
                  {isToday ? " · today" : ""} ·{" "}
                  {list.length ? `${list.length} ${list.length === 1 ? "push" : "pushes"}` : future ? "not yet" : "no pushes"}
                </p>

                <AnimatePresence>
                  {hover?.door === door && (
                    <motion.div
                      className="kraft pointer-events-none absolute z-20 w-max max-w-52 px-3 py-2 shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)]"
                      style={{ left: `${(hover.x / 200) * 100}%`, top: `${(hover.y / 150) * 100 * 0.68}%`, x: "-50%", y: "calc(-100% - 10px)" }}
                      initial={{ opacity: 0, rotate: -4 }}
                      animate={{ opacity: 1, rotate: -1.5, transition: springs.bouncy }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      <p className="font-hand text-base leading-none">
                        {hover.push.repo ?? "push"} · {new Date(hover.push.pushed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                      </p>
                      <p className="mt-1 font-serif text-sm leading-tight italic">{commitTitle(hover.push)}</p>
                      {hover.push.sha && <p className="mt-1 font-mono text-[11px] opacity-70">{hover.push.sha.slice(0, 7)}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
