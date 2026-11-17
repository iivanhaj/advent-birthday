"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { Room } from "@/components/building/Room";

/**
 * What a door shows until its build lands. It opens on exactly the frame the
 * fly-through ended on (the room, full screen, behind glass) so the jump from
 * calendar to door page has no visible cut. Each door replaces this on its day.
 */
export function DoorPlaceholder({ n, lit }: { n: number; lit: boolean }) {
  return (
    <div
      className="relative flex min-h-dvh items-end justify-center"
      style={{ background: lit ? "radial-gradient(ellipse at 50% 28%, #FFF1CC 0%, #FBD99A 50%, #EFB173 100%)" : "var(--color-glass)" }}
    >
      <div className="absolute inset-0 flex items-end justify-center pb-[6dvh]">
        <Room n={n} width={2} className="h-[72%] w-[72%]" />
      </div>
      <motion.p
        className="kraft relative mb-[4dvh] -rotate-1 px-4 py-2 font-hand text-xl shadow-[0_8px_20px_-10px_rgba(74,52,36,0.6)]"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { ...springs.bouncy, delay: 0.5 } }}
      >
        this room is still being furnished… the build lands on its day
      </motion.p>
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
        <p className="font-hand text-2xl">no. {n}</p>
        <h1 className="font-serif text-4xl italic sm:text-5xl">this window is still shuttered</h1>
        <p className="mt-2 font-hand text-2xl">it opens {dateLabel}. no peeking.</p>
      </div>
    </div>
  );
}
