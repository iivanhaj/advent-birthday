"use client";

import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import { Mochi } from "@/components/mochi/Mochi";

/**
 * reducedMotion="user": if the OS says "reduce motion", framer-motion skips
 * transform animations (wiggles, flips, bounces) site-wide and just jumps to
 * the end state. One switch instead of checking in every component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Mochi sits out the full-screen present, and door 9, where she's busy running across the rooftops
  const path = usePathname();
  const away = path === "/surprise" || path === "/door/9";
  return (
    <MotionConfig reducedMotion="user">
      {children}
      {/* Mochi lives in the root layout, so she stays the same cat as you move between pages */}
      {!away && <Mochi />}
    </MotionConfig>
  );
}
