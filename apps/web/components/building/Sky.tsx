"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import type { Sky as SkyData } from "@/lib/sky";

const GRADIENTS: Record<SkyData["phase"], string> = {
  dawn: "linear-gradient(180deg, #E7B7C2 0%, #F6D2C4 45%, #FCEBDF 100%)",
  day: "linear-gradient(180deg, #BFDDEB 0%, #E3EFF2 55%, #F8F1EC 100%)",
  dusk: "linear-gradient(180deg, #4E3F7A 0%, #A9628A 45%, #F0A98E 80%, #F7CFAE 100%)",
  // a soft lavender night rather than near-black, so the page never feels heavy
  night: "linear-gradient(180deg, #2E2858 0%, #4A3F78 55%, #6E5E98 100%)",
};

// Deterministic "random" star field so the server and browser render identical HTML.
// Integer-only hashing (Math.imul): floating-point functions like Math.sin can differ in the
// last digit between Node and browsers, and a hash would amplify that into different stars.
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (k: number) => {
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
  const round = (v: number) => Math.round(v * 100) / 100; // short numbers = identical server/client strings
  return { x: round(r(1) * 100), y: round(r(2) * 62), s: round(1 + r(3) * 2.2), d: round(r(4) * 4) };
});

const CLOUD = "M10 30 C10 20 22 16 28 22 C30 10 48 8 52 20 C58 14 70 18 68 28 C76 28 78 38 70 40 H14 C6 40 4 32 10 30 Z";

/**
 * The real Bangalore sky behind the building. Layers move at different
 * speeds with the parallax input: stars barely, clouds a bit more. The rain
 * is a repeating diagonal-line gradient whose background-position animates,
 * which is far cheaper than thousands of raindrop elements.
 */
export function Sky({ sky, sx, sy }: { sky: SkyData; sx: MotionValue<number>; sy: MotionValue<number> }) {
  const starX = useTransform(sx, (v) => v * -6);
  const starY = useTransform(sy, (v) => v * -4);
  const cloudX = useTransform(sx, (v) => v * -14);
  const night = sky.phase === "night";
  const showStars = night || sky.phase === "dusk";
  const lineOnSky = night || sky.phase === "dusk" ? "rgba(251,241,238,0.75)" : "var(--color-line)";

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: GRADIENTS[sky.phase] }} aria-hidden>
      {showStars && (
        <motion.div className="absolute inset-0" style={{ x: starX, y: starY }}>
          {STARS.map((s, i) => (
            <span
              key={i}
              className="sky-twinkle absolute rounded-full bg-paper"
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s`, opacity: night ? 0.9 : 0.5 }}
            />
          ))}
        </motion.div>
      )}

      {/* sun or moon, fine-line like the building */}
      <motion.svg viewBox="0 0 60 60" className="absolute top-[9%] right-[12%] size-16 sm:size-24" style={{ x: starX, y: starY }}>
        {night ? (
          <path d="M38 12 C24 14 18 30 26 42 C32 50 44 52 50 46 C38 46 30 36 32 24 C33 18 35 15 38 12 Z" fill="rgba(251,241,238,0.9)" stroke="none" />
        ) : (
          <>
            <circle cx="30" cy="30" r="13" fill="var(--color-glow)" fillOpacity={sky.phase === "day" ? 0.55 : 0.8} stroke={lineOnSky} strokeWidth="1.2" />
            {sky.phase === "day" &&
              Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2;
                // Rounded: Node and the browser can disagree on the last digit of Math.cos,
                // which would make the server HTML and the client render differ (hydration error).
                const p = (r: number, f: typeof Math.cos) => (30 + f(a) * r).toFixed(2);
                return <path key={i} d={`M${p(18, Math.cos)} ${p(18, Math.sin)} L${p(23, Math.cos)} ${p(23, Math.sin)}`} stroke={lineOnSky} strokeWidth="1.2" strokeLinecap="round" />;
              })}
          </>
        )}
      </motion.svg>

      {/* drifting fine-line clouds */}
      <motion.div className="absolute inset-0" style={{ x: cloudX }}>
        {[
          { top: "14%", w: 150, dur: 90, delay: -20, op: 0.7 },
          { top: "26%", w: 110, dur: 120, delay: -70, op: 0.5 },
          ...(sky.cloudy || sky.raining ? [{ top: "8%", w: 190, dur: 75, delay: -40, op: 0.8 }, { top: "34%", w: 140, dur: 100, delay: -5, op: 0.6 }] : []),
        ].map((c, i) => (
          <svg
            key={i}
            viewBox="0 0 80 46"
            className="sky-drift absolute"
            style={{ top: c.top, width: c.w, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, opacity: c.op }}
          >
            <path d={CLOUD} fill={night ? "rgba(58,47,91,0.6)" : "rgba(251,241,238,0.55)"} stroke={lineOnSky} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        ))}
      </motion.div>

      {sky.raining && <div className="sky-rain absolute inset-0" />}
    </div>
  );
}
