"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { Room } from "@/components/building/Room";

/**
 * What a door shows until its build lands: the window's little room, framed
 * in an arch on paper, with the door's title. The fly-through lands on the
 * same paper and title, so opening the window has no visible cut.
 */
export function DoorPlaceholder({ n, title, lit }: { n: number; title: string; lit: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 pt-24 pb-16 text-center text-line">
      <motion.div
        className="relative h-64 w-48 overflow-hidden border-[1.5px] border-line sm:h-80 sm:w-60"
        style={{
          borderRadius: "120px 120px 6px 6px / 120px 120px 6px 6px",
          background: lit ? "radial-gradient(ellipse at 50% 30%, #FFF1CC 0%, #FBE3B0 60%, #F6D3A0 100%)" : "var(--color-glass)",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, delay: 0.15 } }}
      >
        <div className="absolute inset-0 flex items-end justify-center pb-4">
          <Room n={n} className="h-[78%] w-[78%]" />
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, delay: 0.3 } }}>
        <p className="font-sans text-[11px] font-medium tracking-[0.2em] uppercase opacity-70">No. {String(n).padStart(2, "0")}</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-5xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-sm font-sans text-sm leading-relaxed opacity-80">
          {lit ? "Work on this room has started. The build lands later today." : "This room is still being furnished. The build lands on its day."}
        </p>
      </motion.div>
    </div>
  );
}

export function SealedDoor({ n, dateLabel, backLink }: { n: number; dateLabel: string; backLink: ReactNode }) {
  const louvers = "repeating-linear-gradient(180deg, transparent 0 10px, color-mix(in srgb, var(--color-line) 40%, transparent) 10px 11px)";
  return (
    <div className="paper-grain relative flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center text-line">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">{backLink}</div>
      {/* a pair of closed shutters that rattle but won't open */}
      <motion.div
        className="flex h-56 w-44 overflow-hidden border-2 border-line"
        style={{ borderRadius: "88px 88px 0 0 / 88px 88px 0 0" }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1, x: [0, -4, 4, -3, 3, 0] }}
        transition={{ ...springs.gentle, x: { delay: 0.7, duration: 0.5 } }}
      >
        <span className="h-full w-1/2 border-r-[1.5px] border-line bg-paper" style={{ backgroundImage: louvers }} />
        <span className="h-full w-1/2 bg-paper" style={{ backgroundImage: louvers }} />
      </motion.div>
      <div>
        <p className="font-sans text-[11px] font-medium tracking-[0.2em] uppercase opacity-70">No. {String(n).padStart(2, "0")}</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Still shuttered</h1>
        <p className="mt-3 font-sans text-sm opacity-80">It opens {dateLabel}. No peeking.</p>
      </div>
    </div>
  );
}
