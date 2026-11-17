"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { springs } from "./motion";

export type DoorFrameProps = {
  /** Door number, 1–11. */
  n: number;
  title: string;
  /** Human date label, e.g. "Wed, Nov 18". */
  dateLabel: string;
  /** Up to three short lines for the folded "what I learned" card. */
  learned?: string[];
  /** Slot for the back link (the app passes a next/link, so this package needs no Next.js). */
  backLink?: ReactNode;
  /** The build itself. Rendered full-bleed. */
  children: ReactNode;
};

/** The shared frame every door page lives in: a kraft title tag, the build full-bleed, a "what I learned" card. */
export function DoorFrame({ n, title, dateLabel, learned = [], backLink, children }: DoorFrameProps) {
  return (
    <div className="paper-grain relative flex min-h-dvh flex-col text-line">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto">{backLink}</div>
        <motion.div
          className="kraft pointer-events-auto origin-top rotate-2 px-4 py-3 shadow-[0_6px_18px_-8px_rgba(74,52,36,0.5)]"
          initial={{ y: -40, rotate: 8, opacity: 0 }}
          animate={{ y: 0, rotate: 2, opacity: 1, transition: { ...springs.bouncy, delay: 0.35 } }}
        >
          <p className="font-hand text-lg leading-none">
            no. {n} · {dateLabel}
          </p>
          <h1 className="mt-1 font-serif text-2xl leading-tight italic sm:text-3xl">{title}</h1>
        </motion.div>
      </header>

      <main className="relative flex-1">{children}</main>

      {learned.length > 0 && <LearnedNote lines={learned} />}
    </div>
  );
}

function LearnedNote({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.ul
            id="learned-note"
            className="kraft mb-2 w-64 max-w-[calc(100vw-2rem)] origin-bottom-right -rotate-1 p-4 font-hand text-xl leading-snug shadow-[0_8px_24px_-10px_rgba(74,52,36,0.6)]"
            initial={{ y: 30, opacity: 0, rotate: 6 }}
            animate={{ y: 0, opacity: 1, rotate: -1, transition: springs.bouncy }}
            exit={{ y: 20, opacity: 0, transition: springs.gentle }}
          >
            {lines.slice(0, 3).map((line) => (
              <li key={line} className="mb-1 last:mb-0">
                — {line}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        aria-expanded={open}
        aria-controls="learned-note"
        onClick={() => setOpen((o) => !o)}
        className="kraft px-4 py-1.5 font-hand text-xl shadow-[0_6px_16px_-8px_rgba(74,52,36,0.6)]"
        whileHover={{ y: -3, rotate: -2 }}
        whileTap={{ scale: 0.94 }}
        transition={springs.squish}
      >
        what I learned
      </motion.button>
    </div>
  );
}
