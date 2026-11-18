"use client";

import { motion } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { FLOORS } from "@/lib/building";

/** Needle angle for each floor on the brass dial (overview points straight up). */
const ANGLE = [60, 20, -20, -60]; // roof, 2, 1, ground

/**
 * The phone elevator: an old-fashioned floor indicator. The needle swings to
 * the current floor; the buttons ride the camera there. Swiping on the
 * building does the same.
 */
export function Elevator({ floor, onFloor }: { floor: number | null; onFloor: (f: number | null) => void }) {
  return (
    <nav aria-label="Floors" className="fixed top-1/2 right-2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-line/25 bg-paper px-1.5 py-2.5 text-line shadow-[0_12px_32px_-12px_rgba(78,30,40,0.35)]">
      <svg viewBox="0 0 40 24" className="w-9" aria-hidden>
        <path d="M4 22 A16 16 0 0 1 36 22" fill="none" stroke="currentColor" strokeWidth="1.4" />
        {ANGLE.map((a) => {
          const r = (a - 90) * (Math.PI / 180);
          const p = (v: number) => v.toFixed(2);
          return <path key={a} d={`M${p(20 + Math.cos(r) * 13)} ${p(22 + Math.sin(r) * 13)} L${p(20 + Math.cos(r) * 16)} ${p(22 + Math.sin(r) * 16)}`} stroke="currentColor" strokeWidth="1.4" />;
        })}
        <motion.path
          d="M20 22 L20 9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          style={{ originX: "20px", originY: "22px" }}
          animate={{ rotate: floor == null ? 0 : -ANGLE[floor] }}
          transition={{ type: "spring", stiffness: 120, damping: 9 }}
        />
        <circle cx="20" cy="22" r="2" fill="currentColor" />
      </svg>
      {FLOORS.map((f, i) => (
        <motion.button
          key={f.id}
          type="button"
          onClick={() => onFloor(i)}
          aria-current={floor === i ? "true" : undefined}
          aria-label={`Go to floor ${f.label}`}
          className="flex size-8 items-center justify-center rounded-full border border-line/40 font-sans text-xs font-medium"
          style={{ background: floor === i ? "var(--color-glow)" : "transparent" }}
          whileTap={{ scale: 0.88 }}
          transition={springs.squish}
        >
          {f.label}
        </motion.button>
      ))}
      <button type="button" onClick={() => onFloor(null)} aria-label="See the whole building" className="mt-0.5 font-sans text-[10px] font-medium tracking-[0.12em] uppercase opacity-75">
        all
      </button>
    </nav>
  );
}
