"use client";

import { useCallback, useEffect, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

type OrientationCtor = { requestPermission?: () => Promise<"granted" | "denied"> };
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * One input for "where is the viewer looking from", as two numbers in -1…1.
 *
 * - Desktop: the mouse position across the screen.
 * - Phones: the gyroscope (DeviceOrientationEvent). `gamma` is left/right
 *   tilt, `beta` is front/back; holding a phone naturally is about beta 45°,
 *   so we measure from there.
 *
 * iOS hides the gyroscope behind a permission prompt that must be triggered
 * by a tap, so we expose `needsPermission` + `requestTilt` for a button.
 * The values go through springs so the scene glides instead of jittering.
 */
export function useParallax() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 45, damping: 16 });
  const sy = useSpring(y, { stiffness: 45, damping: 16 });
  const [needsPermission, setNeedsPermission] = useState(false);

  const onOrient = useCallback(
    (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      x.set(clamp(e.gamma / 25));
      y.set(clamp((e.beta - 45) / 25));
    },
    [x, y],
  );

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set((e.clientX / innerWidth) * 2 - 1);
      y.set((e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener("pointermove", onMove, { passive: true });

    const touch = matchMedia("(pointer: coarse)").matches;
    const Ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
    if (touch && Ctor) {
      if (typeof Ctor.requestPermission === "function") setNeedsPermission(true);
      else addEventListener("deviceorientation", onOrient);
    }
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("deviceorientation", onOrient);
    };
  }, [x, y, onOrient]);

  const requestTilt = useCallback(async () => {
    const Ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
    try {
      if ((await Ctor?.requestPermission?.()) === "granted") {
        addEventListener("deviceorientation", onOrient);
        setNeedsPermission(false);
      }
    } catch {
      /* user said no */
    }
  }, [onOrient]);

  return { sx, sy, needsPermission, requestTilt };
}
