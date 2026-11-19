import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createActor } from "xstate";
import { HUNGRY_AT, NAP_AFTER, leafState, mochiMachine } from "./machine.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running: { stop(): void }[] = [];
after(() => running.forEach((a) => a.stop())); // pending timers would otherwise keep node alive

/** The real machine with every delay shrunk to a few milliseconds and a fixed coin. */
function start(coin = false, delays: Partial<Record<"idle" | "sit" | "groom" | "eat" | "purr", number>> = {}) {
  const machine = mochiMachine.provide({
    delays: { idle: 5, sit: 5, groom: 5, eat: 5, purr: 5, ...delays },
    guards: { coin: () => coin },
  });
  const actor = createActor(machine).start();
  running.push(actor);
  const state = () => leafState(actor.getSnapshot().value);
  return { actor, state };
}

test("starts awake and idle", () => {
  const { state } = start();
  assert.equal(state(), "idle");
});

test("idle turns into a wander, and arriving makes her sit", async () => {
  const { actor, state } = start(false);
  await wait(20);
  assert.equal(state(), "wander");
  actor.send({ type: "ARRIVED" });
  assert.equal(state(), "sit");
});

test("the coin can send her grooming instead", async () => {
  const { state } = start(true, { groom: 10_000 });
  await wait(15);
  assert.equal(state(), "groom");
});

test("the cursor makes her chase, then watch; losing it sends her back to idle", () => {
  const { actor, state } = start();
  actor.send({ type: "CURSOR_MOVE" });
  assert.equal(state(), "chase");
  actor.send({ type: "ARRIVED" });
  assert.equal(state(), "watch");
  actor.send({ type: "CURSOR_LEFT" });
  assert.equal(state(), "idle");
});

test("hunger above the threshold makes her ask for food, and she ignores the cursor", () => {
  const { actor, state } = start();
  actor.send({ type: "HUNGER", value: HUNGRY_AT + 0.05 });
  assert.equal(state(), "hungry");
  actor.send({ type: "CURSOR_MOVE" });
  assert.equal(state(), "hungry");
});

test("food: she goes to it, eats, emits 'ate' and is no longer hungry", async () => {
  const { actor, state } = start();
  let ate = 0;
  actor.on("ate", () => ate++);
  actor.send({ type: "HUNGER", value: 0.95 });
  actor.send({ type: "FOOD_SEEN" });
  assert.equal(state(), "toFood");
  actor.send({ type: "ARRIVED" });
  assert.equal(state(), "eating");
  actor.send({ type: "FOOD_GONE" });
  await wait(15);
  assert.equal(ate, 1);
  assert.equal(actor.getSnapshot().context.hunger, 0);
  assert.notEqual(state(), "hungry");
});

test("more food arriving mid-bite doesn't interrupt the bite", () => {
  const { actor, state } = start();
  actor.send({ type: "FOOD_SEEN" });
  actor.send({ type: "ARRIVED" });
  actor.send({ type: "FOOD_SEEN" });
  assert.equal(state(), "eating");
});

test("she naps after enough boring idle spells, and a click wakes her purring", async () => {
  const { actor, state } = start(false);
  for (let i = 0; i < NAP_AFTER + 1 && state() !== "asleep"; i++) {
    await wait(15); // idle → wander
    actor.send({ type: "ARRIVED" }); // → sit
    await wait(15); // sit → idle (another boring spell)
  }
  assert.equal(state(), "asleep");
  actor.send({ type: "CURSOR_MOVE" });
  assert.equal(state(), "asleep", "sleeps through the cursor");
  actor.send({ type: "PET" });
  assert.equal(state(), "purr");
});

test("the smell of food wakes her up", () => {
  const sleepy = createActor(mochiMachine, { snapshot: mochiMachine.resolveState({ value: "asleep", context: { hunger: 0, boredom: 9, food: false } }) }).start();
  sleepy.send({ type: "FOOD_SEEN" });
  assert.equal(leafState(sleepy.getSnapshot().value), "toFood");
});
