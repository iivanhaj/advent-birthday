"use client";

import { motion } from "framer-motion";
import { VIEW_H, VIEW_W, awningStripes, facadeStrokes } from "@/lib/building";

const STROKES = facadeStrokes();
const STRIPES = awningStripes();

/**
 * The building drawing itself. Each stroke animates `pathLength` 0 → 1 (the
 * pen moving along the line), staggered so the outline goes first and the
 * small details last. `fast` is used on repeat visits in the same session so
 * it doesn't make you wait every time.
 */
export function Facade({ fast, night }: { fast: boolean; night: boolean }) {
  const total = fast ? 0.5 : 1.9;
  const each = fast ? 0.25 : 0.55;
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <Ground night={night} delay={total * 0.2} />
      {/* the wall itself is paper-coloured so the sky doesn't show through */}
      <motion.path
        d="M40 700 V92 H440 V700 Z"
        fill="var(--color-paper)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: total * 0.3 }}
      />
      <motion.path
        d="M28 72 H452 V92 H28 Z M190 72 C190 30 290 30 290 72 Z M370 72 V36 H398 V72 Z M40 540 H440 L450 572 H30 Z"
        fill="var(--color-paper)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: total * 0.3 }}
      />
      {STRIPES.map((d, i) => (
        <motion.path key={d} d={d} fill="var(--color-line)" initial={{ opacity: 0 }} animate={{ opacity: 0.16 }} transition={{ delay: total * 0.75 + i * 0.03 }} />
      ))}
      <g fill="none" stroke="var(--color-line)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {STROKES.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: each, delay: (i / STROKES.length) * total, ease: "easeInOut" },
              opacity: { duration: 0.01, delay: (i / STROKES.length) * total },
            }}
          />
        ))}
      </g>
      <motion.text
        x="358"
        y="694"
        textAnchor="middle"
        className="font-hand"
        fontSize="15"
        fill="var(--color-line)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: total + 0.2 }}
      >
        est. nov 28
      </motion.text>
    </svg>
  );
}

/**
 * The street the building stands on: a pavement with paving joints, a kerb,
 * and a quiet road with a dashed centre line. It's drawn far wider than the
 * viewBox (x from -2000 to 2480) and the SVG has overflow: visible, so it
 * runs edge to edge on any screen while staying in the same coordinates as
 * the building (it moves with the camera and parallax).
 */
function Ground({ night, delay }: { night: boolean; delay: number }) {
  const pavement = night ? "#4A3F72" : "#F3E4DF";
  const road = night ? "#3B3260" : "#ECDAD3";
  const ink = night ? "rgba(251,241,238,0.5)" : "var(--color-line)";
  const joints = [];
  for (let x = -1996; x < 2480; x += 36) joints.push(`M${x} 700 L${x - 4} 716`);
  const dashes = [];
  for (let x = -2000; x < 2480; x += 40) dashes.push(`M${x} 760 h18`);
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay }}>
      <rect x={-2000} y={700} width={4480} height={16} fill={pavement} />
      <rect x={-2000} y={716} width={4480} height={700} fill={road} />
      <g fill="none" stroke={ink} strokeWidth={1.5} strokeLinecap="round">
        <path d="M-2000 700 H2480" vectorEffect="non-scaling-stroke" />
        <path d="M-2000 716 H2480" vectorEffect="non-scaling-stroke" />
        <path d="M-2000 720 H2480" vectorEffect="non-scaling-stroke" opacity={0.5} />
        <path d={joints.join(" ")} vectorEffect="non-scaling-stroke" opacity={0.35} />
        <path d={dashes.join(" ")} vectorEffect="non-scaling-stroke" opacity={0.45} />
      </g>
    </motion.g>
  );
}

/** A street lamp and a bench in front of the building: the closest layer, so it moves the most. */
export function Foreground({ lit, fast }: { lit: boolean; fast: boolean }) {
  return (
    <svg viewBox="0 0 480 720" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id="lampGlow">
          <stop offset="0%" stopColor="#FFE9B8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFE9B8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit && <motion.circle cx="-26" cy="520" r="70" fill="url(#lampGlow)" className="lamp-flicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: fast ? 0.6 : 2.2, duration: 0.8 }} />}
      <motion.g
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: fast ? 0.3 : 1.6, duration: 0.6 }}
      >
        {/* lamp post and bench now stand on the pavement (y = 708) */}
        <path d="M-26 708 V540 M-34 708 H-18 M-26 540 C-26 528 -14 524 -10 532" vectorEffect="non-scaling-stroke" />
        <path d="M-40 520 H-12 L-16 540 H-36 Z M-30 520 L-26 512 L-22 520" fill={lit ? "#FFE9B8" : "var(--color-paper)"} vectorEffect="non-scaling-stroke" />
        <path d="M470 686 H530 M476 686 V708 M524 686 V708 M470 672 H530 V686 M472 672 V656 H528 V672" fill="var(--color-paper)" vectorEffect="non-scaling-stroke" />
      </motion.g>
    </svg>
  );
}
