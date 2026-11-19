"use client";

import { useSyncExternalStore } from "react";
import { createActor, type ActorRefFrom, type SnapshotFrom } from "xstate";
import { mochiMachine } from "@/lib/mochi/machine.ts";

/**
 * One Mochi per page: a single running actor shared by the runtime (which
 * drives her) and anything that wants to watch her, like door 2's live
 * statechart diagram. It lives at module level, so client-side navigation
 * between pages keeps the same cat with the same mood.
 */
let actor: ActorRefFrom<typeof mochiMachine> | null = null;

export function mochi() {
  if (!actor) actor = createActor(mochiMachine).start();
  return actor;
}

type Snap = SnapshotFrom<typeof mochiMachine>;
const subscribe = (cb: () => void) => {
  const sub = mochi().subscribe(cb);
  return () => sub.unsubscribe();
};

/** Re-renders whenever Mochi changes state. Null on the server (she only exists in the browser). */
export function useMochiSnapshot(): Snap | null {
  return useSyncExternalStore(
    subscribe,
    () => mochi().getSnapshot(),
    () => null,
  );
}
