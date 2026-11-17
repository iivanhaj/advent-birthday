import { ROOMS } from "@/lib/building";

/**
 * The tiny room behind a window. `vector-effect: non-scaling-stroke` keeps the
 * line weight identical whether the room is 50px inside a window or filling
 * the whole screen on the door page: that consistency is what makes it read
 * as one illustration.
 */
export function Room({ n, color = "var(--color-line)", width = 1.5, className }: { n: number; color?: string; width?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden>
      <path d={ROOMS[n]} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
