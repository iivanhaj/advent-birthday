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

/** The shared frame every door page lives in: a title card, the build full-bleed, a "what I learned" note. */
export function DoorFrame({ n, title, dateLabel, learned = [], backLink, children }: DoorFrameProps) {
  return (
    <div className="paper-grain relative flex min-h-dvh flex-col text-line">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto">{backLink}</div>
        <motion.div
          data-mochi-platform="title card"
          className="pointer-events-auto rounded-md border border-line/25 bg-paper px-4 py-3 text-line shadow-[0_12px_32px_-12px_rgba(78,30,40,0.35)]"
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { ...springs.gentle, delay: 0.3 } }}
        >
          <p className="font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70">
            No. {String(n).padStart(2, "0")} · {dateLabel}
          </p>
          <h1 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">{title}</h1>
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
            className="mb-2 w-72 max-w-[calc(100vw-2rem)] origin-bottom-right rounded-md border border-line/25 bg-paper p-4 font-sans text-[13px] leading-relaxed text-line shadow-[0_12px_32px_-12px_rgba(78,30,40,0.35)]"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { duration: 0.18 } }}
            exit={{ y: 6, opacity: 0, transition: { duration: 0.12 } }}
          >
            {lines.slice(0, 3).map((line) => (
              <li key={line} className="mb-2 border-l border-line/30 pl-3 last:mb-0">
                {line}
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
        className="rounded-full border border-line/30 bg-paper px-4 py-2 font-sans text-xs font-medium tracking-wide text-line shadow-[0_8px_24px_-12px_rgba(78,30,40,0.35)] transition-colors hover:bg-glass"
        whileTap={{ scale: 0.97 }}
      >
        What I learned
      </motion.button>
    </div>
  );
}
