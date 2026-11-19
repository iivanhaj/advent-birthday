"use client";

import { MotionConfig } from "framer-motion";
import { Mochi } from "@/components/mochi/Mochi";

/**
 * reducedMotion="user": if the OS says "reduce motion", framer-motion skips
 * transform animations (wiggles, flips, bounces) site-wide and just jumps to
 * the end state. One switch instead of checking in every component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      {/* Mochi lives in the root layout, so she stays the same cat as you move between pages */}
      <Mochi />
    </MotionConfig>
  );
}
