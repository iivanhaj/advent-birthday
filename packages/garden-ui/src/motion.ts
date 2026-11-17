import type { Transition, TargetAndTransition } from "framer-motion";

/**
 * Springs, never linear. A spring is described by stiffness (how hard it pulls
 * toward the target) and damping (how quickly the wobble dies out). Low damping
 * = more bounce.
 */
export const springs = {
  /** Page-level things settling into place. */
  gentle: { type: "spring", stiffness: 170, damping: 20 },
  /** Little pops: a sprout appearing, a note unfolding. */
  bouncy: { type: "spring", stiffness: 420, damping: 14 },
  /** Click feedback: fast in, slight overshoot back out. */
  squish: { type: "spring", stiffness: 600, damping: 15 },
} satisfies Record<string, Transition>;

/** Hover = a gentle wiggle. Multi-keyframe animations can't use a spring, so this one eases. */
export const wiggle: TargetAndTransition = {
  rotate: [0, -5, 4, -2, 0],
  transition: { duration: 0.5, ease: "easeInOut" },
};

/** Click = a squish. */
export const squish: TargetAndTransition = {
  scale: 0.9,
  transition: springs.squish,
};

/** Spread onto any motion element: `<motion.div {...wiggleSquish}>`. */
export const wiggleSquish = {
  whileHover: wiggle,
  whileTap: squish,
  whileFocus: wiggle,
} as const;

/** A leaf fluttering in: used for door pages entering. */
export const leafFlutterIn = {
  initial: { opacity: 0, y: -24, rotate: -4 },
  animate: { opacity: 1, y: 0, rotate: 0, transition: springs.gentle },
} as const;
