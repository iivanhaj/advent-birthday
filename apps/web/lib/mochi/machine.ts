import { assign, emit, setup, stateIn } from "xstate";

/**
 * Mochi's brain, as a statechart.
 *
 * The machine only decides *what* she wants to do. The runtime (the animation
 * loop) decides *how*: it plans a route across the page, walks and jumps along
 * it, and reports back with events like ARRIVED. Keeping the two apart means
 * this file has no DOM, no timers of its own and no randomness it can't be
 * handed, so every behaviour below is covered by plain unit tests.
 *
 *   awake ─┬─ idle ──(after a while)──► wander | groom | sit
 *          ├─ chase ⇄ watch           (your cursor)
 *          ├─ hungry                   (no push for hours)
 *          ├─ toFood ─► eating         (kibble from a push)
 *          └─ purr                     (you clicked her)
 *   asleep                             (bored: nothing happened for a while)
 */

export type MochiEvent =
  | { type: "HUNGER"; value: number } // 0 (just ate) … 1 (starving)
  | { type: "FOOD_SEEN" }
  | { type: "FOOD_GONE" }
  | { type: "ARRIVED" }
  | { type: "CURSOR_MOVE" }
  | { type: "CURSOR_LEFT" }
  | { type: "PET" };

export type MochiContext = {
  hunger: number;
  /** Idle spells in a row with nothing happening. Enough of them and she naps. */
  boredom: number;
  food: boolean;
};

/** Hunger above this and she stops playing and asks for food. */
export const HUNGRY_AT = 0.7;
/** Idle spells in a row before she falls asleep. */
export const NAP_AFTER = 4;

export const mochiMachine = setup({
  types: {
    context: {} as MochiContext,
    events: {} as MochiEvent,
    emitted: {} as { type: "ate" },
  },
  delays: {
    // Named delays, so tests can shrink them and the site can tune them.
    idle: 2600,
    sit: 4200,
    groom: 3200,
    eat: 1800,
    purr: 2200,
  },
  guards: {
    isHungry: ({ context }) => context.hunger >= HUNGRY_AT,
    hasFood: ({ context }) => context.food,
    isBored: ({ context }) => context.boredom >= NAP_AFTER,
    // A coin flip; swapped for a fixed answer in tests.
    coin: () => Math.random() < 0.4,
  },
  actions: {
    bored: assign({ boredom: ({ context }) => context.boredom + 1 }),
    engaged: assign({ boredom: 0 }),
  },
}).createMachine({
  id: "mochi",
  context: { hunger: 0, boredom: 0, food: false },
  initial: "awake",
  on: {
    HUNGER: { actions: assign({ hunger: ({ event }) => event.value }) },
    // She drops whatever she's doing for food (but finishes the bite she's on).
    FOOD_SEEN: [
      { guard: stateIn({ awake: "eating" }), actions: assign({ food: true }) },
      { target: ".awake.toFood", actions: [assign({ food: true }), "engaged"] },
    ],
    FOOD_GONE: { actions: assign({ food: false }) },
  },
  states: {
    awake: {
      initial: "idle",
      states: {
        idle: {
          entry: "bored",
          always: [
            { guard: "hasFood", target: "toFood" },
            { guard: "isHungry", target: "hungry" },
            { guard: "isBored", target: "#mochi.asleep" },
          ],
          after: {
            idle: [{ guard: "coin", target: "groom" }, { target: "wander" }],
          },
          on: { CURSOR_MOVE: { target: "chase", actions: "engaged" } },
        },
        wander: {
          on: {
            ARRIVED: "sit",
            CURSOR_MOVE: { target: "chase", actions: "engaged" },
          },
        },
        sit: {
          after: { sit: "idle" },
          on: { CURSOR_MOVE: { target: "chase", actions: "engaged" } },
        },
        groom: {
          after: { groom: "idle" },
          on: { CURSOR_MOVE: { target: "chase", actions: "engaged" } },
        },
        chase: {
          on: {
            ARRIVED: "watch",
            CURSOR_LEFT: "idle",
          },
        },
        watch: {
          on: {
            CURSOR_MOVE: { target: "chase", actions: "engaged" },
            CURSOR_LEFT: "idle",
          },
        },
        hungry: {
          // Too hungry to play: she sits and asks. Only food (or a push) helps.
          always: { guard: ({ context }) => context.hunger < HUNGRY_AT, target: "idle" },
        },
        toFood: {
          on: {
            ARRIVED: "eating",
            FOOD_GONE: { target: "idle", actions: assign({ food: false }) },
          },
        },
        eating: {
          // Leaving this state is when the kibble is actually eaten: the runtime listens for "ate".
          after: { eat: { target: "idle", actions: [emit({ type: "ate" }), assign({ hunger: 0, boredom: 0 })] } },
        },
        purr: {
          after: { purr: "idle" },
        },
      },
      on: {
        PET: { target: ".purr", actions: "engaged" },
      },
    },
    asleep: {
      // She sleeps through the cursor; a click or the smell of food wakes her.
      on: {
        PET: { target: "awake.purr", actions: "engaged" },
      },
    },
  },
});

export type MochiState = "idle" | "wander" | "sit" | "groom" | "chase" | "watch" | "hungry" | "toFood" | "eating" | "purr" | "asleep";

/** The leaf state as one flat name: what the runtime and the drawing switch on. */
export function leafState(value: unknown): MochiState {
  if (value === "asleep") return "asleep";
  if (value && typeof value === "object" && "awake" in value) return (value as { awake: MochiState }).awake;
  return "idle";
}
