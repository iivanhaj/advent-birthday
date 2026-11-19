"use client";

import { useEffect, useState } from "react";
import { useLivePushes } from "@/components/building/useLivePushes";
import { mochi, useMochiSnapshot } from "@/components/mochi/actor";
import { StateDiagram } from "@/components/mochi/StateDiagram";
import { leafState, type MochiState } from "@/lib/mochi/machine.ts";
import { commitTitle, type PushRow } from "@/lib/pushes";

/**
 * Door 2 · Mochi's home. Mochi herself roams every page (she's mounted in the
 * root layout); this page shows what's going on inside her head, live, and
 * lets you feed her or see the route she's planning.
 */

const MOOD: Record<MochiState, string> = {
  idle: "Looking around",
  wander: "Off exploring",
  sit: "Sitting pretty",
  groom: "Grooming",
  chase: "Chasing your cursor",
  watch: "Watching you",
  hungry: "Hungry. Waiting for a push",
  toFood: "Going for food",
  eating: "Eating",
  purr: "Purring",
  asleep: "Asleep",
};

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

const card = "rounded-lg border border-line/20 bg-paper/90 p-5 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)]";
const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";

export function MochiHome({ initialPushes, today }: { initialPushes: PushRow[]; today: string }) {
  const { pushes } = useLivePushes(initialPushes);
  const snap = useMochiSnapshot();
  const state = snap ? leafState(snap.value) : null;
  const hunger = snap?.context.hunger ?? 0;
  const [now, setNow] = useState<number | null>(null);
  const [route, setRoute] = useState(false);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // turn the route overlay off when leaving the page
  useEffect(() => () => void dispatchEvent(new CustomEvent("mochi:debug", { detail: false })), []);

  const sorted = [...pushes].sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at));
  const last = sorted[0];
  const mealsToday = pushes.filter((p) => p.ist_date === today).length;

  const toggleRoute = () => {
    const next = !route;
    setRoute(next);
    dispatchEvent(new CustomEvent("mochi:debug", { detail: next }));
  };

  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <p className={eyebrow}>Meet Mochi</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">She lives on every page of this site.</h2>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Every git push I make drops a piece of kibble onto every open screen, live, and she goes and gets it. Bring your cursor near her, click her,
          or leave her alone long enough and she&rsquo;ll nap.
        </p>

        <div className="mt-8 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <section data-mochi-platform="stats" className={card}>
              <p className={eyebrow}>Right now</p>
              <p className="mt-1 font-serif text-2xl">{state ? MOOD[state] : "…"}</p>
              <div className="mt-4 flex items-baseline justify-between font-sans text-xs">
                <span>Hunger</span>
                <span className="tabular-nums opacity-70">{Math.round(hunger * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/15">
                <div className="h-full rounded-full bg-line transition-[width] duration-700" style={{ width: `${Math.round(hunger * 100)}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 font-sans text-xs">
                <div>
                  <dt className="opacity-60">Last meal</dt>
                  <dd className="mt-0.5">{last && now ? ago(last.pushed_at, now) : "…"}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Meals today</dt>
                  <dd className="mt-0.5 tabular-nums">{mealsToday}</dd>
                </div>
              </dl>
              {last && <p className="mt-3 truncate font-mono text-[11px] opacity-60">{commitTitle(last)}</p>}
            </section>

            <section data-mochi-platform="actions" className={`${card} flex flex-wrap content-start gap-2`}>
              <p className={`${eyebrow} w-full`}>Say hi</p>
              <p className="mb-2 w-full font-sans text-xs leading-relaxed opacity-75">
                Treats only tide her over: real meals come from pushes. The route view shows the ledges she can see and the path she&rsquo;s planning.
              </p>
              <button type="button" onClick={() => dispatchEvent(new Event("mochi:treat"))} className="rounded-full border border-line/30 px-4 py-2 font-sans text-xs font-medium transition-colors hover:bg-glass">
                Drop a treat
              </button>
              <button type="button" onClick={() => mochi().send({ type: "PET" })} className="rounded-full border border-line/30 px-4 py-2 font-sans text-xs font-medium transition-colors hover:bg-glass">
                Pet her
              </button>
              <button
                type="button"
                aria-pressed={route}
                onClick={toggleRoute}
                className={`rounded-full border border-line/30 px-4 py-2 font-sans text-xs font-medium transition-colors hover:bg-glass ${route ? "bg-glass" : ""}`}
              >
                {route ? "Hide her route" : "Show her route"}
              </button>
            </section>
          </div>
          <section data-mochi-platform="mind" className={card}>
            <p className={eyebrow}>Her mind, live</p>
            <p className="mt-1 font-sans text-xs opacity-75">A statechart. The lit state is what she&rsquo;s doing right now; dashed arrows fire on their own (timers and conditions).</p>
            <div className="mt-3">
              <StateDiagram />
            </div>
            <p className="mt-2 font-sans text-[11px] opacity-60">From any state: food lands → toFood. Cursor near also starts a chase from wander, sit and groom.</p>
          </section>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            ["Brain", "A statechart (XState) decides what she wants: wander, chase, eat, nap. It's pure logic, so every behaviour has a unit test."],
            ["Route", "The page is her level: every ledge she can stand on is a node, and A* search finds the cheapest mix of walks and jumps to her goal."],
            ["Jumps", "Each jump is a real projectile arc: solve for the launch speed that clears the higher ledge, then y = y₀ + v₀t + ½gt²."],
          ].map(([t, d]) => (
            <section key={t} data-mochi-platform={`how ${t}`} className={card}>
              <p className={eyebrow}>{t}</p>
              <p className="mt-2 font-sans text-[13px] leading-relaxed opacity-85">{d}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
