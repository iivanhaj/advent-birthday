"use client";

import { MotionConfig } from "framer-motion";

/**
 * reducedMotion="user": if the OS says "reduce motion", framer-motion skips
 * transform animations (wiggles, flips, bounces) site-wide and just jumps to
 * the end state. One switch instead of checking in every component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
