"use client";

import { motion } from "framer-motion";

const BURSTS = [
  { x: 110, y: -10, r: 46, delay: 0 },
  { x: 360, y: -40, r: 56, delay: 0.9 },
  { x: 240, y: -90, r: 64, delay: 1.7 },
  { x: 60, y: -110, r: 38, delay: 2.4 },
  { x: 420, y: -120, r: 42, delay: 3.1 },
];
const RAYS = 14;

/**
 * Fine-line fireworks over the roof for the finale. Each burst is a ring of
 * rays drawn outward (pathLength), then faded, on a loop. Same pen, same line
 * weight as the building, so the celebration still looks hand-drawn.
 */
export function Fireworks({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 480 720" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      {BURSTS.map((b, bi) => (
        <g key={bi} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round">
          {Array.from({ length: RAYS }, (_, i) => {
            const a = (i / RAYS) * Math.PI * 2;
            const inner = b.r * 0.25;
            const d = `M${(b.x + Math.cos(a) * inner).toFixed(1)} ${(b.y + Math.sin(a) * inner).toFixed(1)} L${(b.x + Math.cos(a) * b.r).toFixed(1)} ${(b.y + Math.sin(a) * b.r).toFixed(1)}`;
            return (
              <motion.path
                key={i}
                d={d}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
                transition={{ duration: 1.6, times: [0, 0.45, 1], delay: 2.6 + b.delay, repeat: Infinity, repeatDelay: 2.2, ease: "easeOut" }}
              />
            );
          })}
          <motion.circle
            cx={b.x}
            cy={b.y}
            r={3}
            fill={color}
            stroke="none"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0.4] }}
            transition={{ duration: 0.9, delay: 2.4 + b.delay, repeat: Infinity, repeatDelay: 2.9 }}
          />
        </g>
      ))}
    </svg>
  );
}
