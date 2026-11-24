"use client";

import { motion } from "framer-motion";
import { VIEW_H, VIEW_W, awningStripes, buntingFlags, facadeDetails, facadeStrokes } from "@/lib/building";

const STROKES = facadeStrokes();
const STRIPES = awningStripes();
const DETAILS = facadeDetails();
const FLAGS = buntingFlags();

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
      {/* invisible ledges for Mochi: the cornice, the pediment's top and the awning */}
      <rect data-mochi-platform="cornice" x={28} y={72} width={424} height={1} fill="none" />
      <rect data-mochi-platform="chimney" x={366} y={36} width={36} height={1} fill="none" />
      <rect data-mochi-platform="awning" x={40} y={540} width={400} height={1} fill="none" />
      {STRIPES.map((d, i) => (
        <motion.path key={d} d={d} fill="var(--color-line)" initial={{ opacity: 0 }} animate={{ opacity: 0.16 }} transition={{ delay: total * 0.75 + i * 0.03 }} />
      ))}
      {/* the shop window glows at night */}
      {night && <motion.path d="M296 600 H420 V670 H296 Z" fill="#FBD99A" initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} transition={{ delay: total + 0.4, duration: 0.8 }} />}
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
      {/* the finer trim and the faint stucco, once the outline has been drawn */}
      <motion.g
        fill="none"
        stroke="var(--color-line)"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: total * 0.85 }}
      >
        <path d={DETAILS.texture.join(" ")} strokeWidth={0.7} opacity={0.14} vectorEffect="non-scaling-stroke" />
        <path d={DETAILS.trim.join(" ")} strokeWidth={1} opacity={0.85} vectorEffect="non-scaling-stroke" />
        {FLAGS.map((d, i) => (
          <path key={d} d={d} fill={i % 2 ? "rgba(229,143,168,.4)" : "rgba(242,196,90,.45)"} stroke="none" />
        ))}
      </motion.g>
      <motion.text
        x="358"
        y="694"
        textAnchor="middle"
        className="font-serif italic"
        fontSize="11"
        letterSpacing="0.5"
        fill="var(--color-line)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: total + 0.2 }}
      >
        Est. 28 Nov
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
      <rect data-mochi-platform="pavement" x={-2000} y={700} width={4480} height={16} fill={pavement} />
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
      {lit &&
        [-26, 566].map((x) => (
          <motion.circle key={x} cx={x} cy="520" r="70" fill="url(#lampGlow)" className="lamp-flicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: fast ? 0.6 : 2.2, duration: 0.8 }} />
        ))}
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
        {/* a second lamp on the far side, facing the first */}
        <path d="M566 708 V540 M558 708 H574 M566 540 C566 528 554 524 550 532" vectorEffect="non-scaling-stroke" />
        <path d="M552 520 H580 L576 540 H556 Z M562 520 L566 512 L570 520" fill={lit ? "#FFE9B8" : "var(--color-paper)"} vectorEffect="non-scaling-stroke" />
        {/* planters at the kerb, a rosemary and a lavender */}
        {[-80, 620].map((x) => (
          <g key={x}>
            <path d={`M${x - 14} 708 L${x - 17} 690 H${x + 17} L${x + 14} 708 Z M${x - 17} 694 H${x + 17}`} fill="var(--color-paper)" vectorEffect="non-scaling-stroke" />
            <path d={`M${x} 690 C${x - 2} 676 ${x - 8} 668 ${x - 12} 664 M${x} 690 C${x + 1} 674 ${x + 2} 666 ${x + 1} 658 M${x} 690 C${x + 3} 678 ${x + 9} 670 ${x + 13} 666 M${x - 7} 690 C${x - 9} 682 ${x - 14} 678 ${x - 18} 676 M${x + 7} 690 C${x + 9} 682 ${x + 14} 679 ${x + 18} 678`} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <path d="M470 686 H530 M476 686 V708 M524 686 V708 M470 672 H530 V686 M472 672 V656 H528 V672" fill="var(--color-paper)" vectorEffect="non-scaling-stroke" />
      </motion.g>
      {/* invisible ledges for Mochi: the bench seat and the lamp's cap */}
      <rect data-mochi-platform="bench" x={470} y={672} width={60} height={1} fill="none" />
      <rect data-mochi-platform="lamp" x={-40} y={512} width={28} height={1} fill="none" />
      <rect data-mochi-platform="far lamp" x={552} y={512} width={28} height={1} fill="none" />
    </svg>
  );
}
