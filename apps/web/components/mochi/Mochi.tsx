"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { leafState, type MochiState } from "@/lib/mochi/machine.ts";
import { DEFAULT_REACH, findRoute, jumpArc, surfaceBelow, type Platform, type Step } from "@/lib/mochi/world.ts";
import { browserClient } from "@/lib/supabase/browser";
import { mochi } from "./actor";
import { ANCHOR, MochiSprite, SPRITE_H, SPRITE_W, type Pose } from "./MochiSprite";

/**
 * The runtime: Mochi's body.
 *
 * Every animation frame it (1) measures the page's ledges, (2) keeps her
 * stuck to whatever she's standing on (the building zooms and scrolls under
 * her), (3) moves her along the current route: walking, or flying a jump
 * arc, and (4) tells the statechart what happened (ARRIVED, food landed,
 * your cursor came close). The statechart answers by changing state, and the
 * runtime turns each new state into a goal and plans a route to it with A*.
 *
 * Food comes from real pushes: Supabase Realtime streams each new row in
 * `pushes`, and a piece of kibble drops onto every open page.
 */

const GRAVITY = 2600; // px/s², shared with the jump arcs so falls and jumps feel the same
const HUNGRY_AFTER_H = 6; // hours without a push until she's starving
const NOTICE_PX = 150; // cursor this close and she notices it
const LOSE_PX = 520; // and this far and she gives up the chase

type Kibble = { id: string; x: number; y: number; vy: number; pid: string | null; dx: number; dead?: boolean; far?: boolean };
type Mode = "stand" | "walk" | "jump" | "fall";

/** Each marked element gets a stable id for as long as it's on the page. */
const ids = new WeakMap<Element, string>();
let nextId = 0;

function measure(): Platform[] {
  const W = innerWidth;
  const H = innerHeight;
  const out: Platform[] = [{ id: "ground", x0: 0, x1: W, y: H - 3 }];
  document.querySelectorAll("[data-mochi-platform]").forEach((el) => {
    const r = el.getBoundingClientRect();
    const x0 = Math.max(6, r.left);
    const x1 = Math.min(W - 6, r.right);
    if (x1 - x0 < 34 || r.top < 70 || r.top > H - 6) return;
    let id = ids.get(el);
    if (!id) ids.set(el, (id = `p${nextId++}`));
    out.push({ id, x0, x1, y: r.top });
  });
  return out;
}

const spriteWidth = () => Math.round(Math.min(96, Math.max(64, innerWidth * 0.065)));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Mochi() {
  const [on, setOn] = useState(false);
  const [, render] = useReducer((n: number) => n + 1, 0);
  const sim = useRef({
    x: 0,
    y: -80,
    pid: null as string | null,
    dir: 1 as 1 | -1,
    phase: 0,
    vy: 0,
    mode: "fall" as Mode,
    route: [] as Step[],
    i: 0,
    t: 0,
    arc: null as ReturnType<typeof jumpArc> | null,
    goal: null as null | { pid: string; x: number; kind: "wander" | "chase" | "food"; key: string },
    width: 80,
    pose: "stand" as Pose,
    state: "idle" as MochiState,
  });
  const food = useRef<Kibble[]>([]);
  const cursor = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastMeal = useRef(Date.now() - 2 * 3600_000);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; // no roaming cat for reduced motion
    setOn(true);
    const actor = mochi();
    const s = sim.current;
    s.width = spriteWidth();
    s.x = innerWidth * 0.72;

    // ---- hunger: worked out from the push log, not a timer ----
    const sendHunger = () => actor.send({ type: "HUNGER", value: Math.min(1, (Date.now() - lastMeal.current) / (HUNGRY_AFTER_H * 3600_000)) });
    const supabase = browserClient();
    supabase
      ?.from("pushes")
      .select("pushed_at")
      .order("pushed_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const at = data?.[0]?.pushed_at;
        if (at) lastMeal.current = Math.max(lastMeal.current, Date.parse(at));
        sendHunger();
      });
    const hungerTimer = setInterval(sendHunger, 20_000);

    // ---- food: one kibble per push, live ----
    const drop = (id: string) => food.current.push({ id, x: rand(innerWidth * 0.12, innerWidth * 0.88), y: -20, vy: 0, pid: null, dx: 0 });
    const channel = supabase
      ?.channel("mochi-pushes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pushes" }, (payload) => {
        const row = payload.new as { delivery_id: string; pushed_at: string };
        lastMeal.current = Math.max(lastMeal.current, Date.parse(row.pushed_at));
        drop(row.delivery_id);
      })
      .subscribe();
    const onTreat = () => {
      lastMeal.current = Date.now();
      drop(`treat-${Date.now()}`);
    };
    addEventListener("mochi:treat", onTreat);

    // ---- your cursor ----
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") cursor.current = { x: e.clientX, y: e.clientY, at: performance.now() };
    };
    const onLeave = () => (cursor.current = null);
    addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    const onResize = () => (s.width = spriteWidth());
    addEventListener("resize", onResize);

    // ---- when she eats, the kibble nearest her mouth disappears ----
    const ateSub = actor.on("ate", () => {
      const mouth = s.x + s.dir * s.width * 0.3;
      const near = food.current.filter((k) => k.pid && !k.dead && !k.far).sort((a, b) => Math.abs(a.x - mouth) - Math.abs(b.x - mouth))[0];
      if (near) near.dead = true;
      food.current = food.current.filter((k) => !k.dead);
      if (!food.current.some((k) => k.pid && !k.far)) actor.send({ type: "FOOD_GONE" });
    });

    let prev = new Map<string, Platform>();
    let last = performance.now();
    let replanAt = 0;
    let raf = 0;

    /** Plan a route to `goal` from where she stands. Mid-jump, wait for the landing. */
    function goTo(platforms: Platform[], goal: NonNullable<typeof s.goal>) {
      s.goal = goal;
      if (s.mode === "jump" || s.mode === "fall" || !s.pid) return;
      const target = platforms.find((p) => p.id === goal.pid);
      if (!target) return arrive();
      const route = findRoute(platforms, { pid: s.pid, x: s.x, y: s.y }, { pid: goal.pid, x: goal.x, y: target.y }, { ...DEFAULT_REACH, up: s.width * 2.2 });
      if (!route) {
        // Out of reach. Food she can't get to stays where it is (a little monument to that push).
        if (goal.kind === "food") {
          const k = food.current.find((f) => f.id === goal.key);
          if (k) k.far = true;
          s.goal = null;
          if (!food.current.some((f) => f.pid && !f.far && !f.dead)) actor.send({ type: "FOOD_GONE" });
          return;
        }
        return arrive();
      }
      s.route = route;
      s.i = 0;
      s.t = 0;
      s.arc = null;
    }
    function arrive() {
      const g = s.goal;
      s.route = [];
      s.goal = null;
      if (g?.kind === "food") {
        const k = food.current.find((f) => f.id === g.key);
        if (k) s.dir = k.x >= s.x ? 1 : -1;
      }
      if (g) actor.send({ type: "ARRIVED" });
    }
    function stop() {
      // finish a jump in progress, then stand still
      s.route = s.mode === "jump" ? s.route.slice(s.i, s.i + 1) : [];
      s.i = 0;
      s.goal = null;
    }

    /** A goal for the current state. */
    function plan(platforms: Platform[]) {
      const st = s.state;
      if (st === "wander") {
        const ledges = platforms.filter((p) => p.x1 - p.x0 > s.width * 0.8);
        for (let tries = 0; tries < 8; tries++) {
          const p = ledges[Math.floor(Math.random() * ledges.length)];
          const x = rand(p.x0 + s.width * 0.4, p.x1 - s.width * 0.4);
          if (Math.abs(x - s.x) < 60 && p.id === s.pid) continue;
          return goTo(platforms, { pid: p.id, x, kind: "wander", key: `w${tries}` });
        }
        return goTo(platforms, { pid: "ground", x: rand(40, innerWidth - 40), kind: "wander", key: "w" });
      }
      if (st === "chase") {
        const c = cursor.current;
        if (!c) return;
        const surface = surfaceBelow(platforms, c.x, c.y) ?? platforms[0];
        const side = c.x >= s.x ? -1 : 1; // stop just short of the cursor, facing it
        return goTo(platforms, { pid: surface.id, x: c.x + side * s.width * 0.45, kind: "chase", key: `${surface.id}:${Math.round(c.x / 40)}` });
      }
      if (st === "toFood") {
        const landed = food.current.filter((k) => k.pid && !k.dead && !k.far);
        if (!landed.length) return void actor.send({ type: "FOOD_GONE" });
        const k = landed.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
        const side = k.x >= s.x ? -1 : 1;
        return goTo(platforms, { pid: k.pid!, x: k.x + side * s.width * 0.32, kind: "food", key: k.id });
      }
      stop();
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const platforms = measure();
      const byId = new Map(platforms.map((p) => [p.id, p]));

      // 1. ledges move (zoom, scroll, parallax): she moves with the one she's on
      if (s.pid && (s.mode === "stand" || s.mode === "walk")) {
        const p = byId.get(s.pid);
        const was = prev.get(s.pid);
        if (!p) {
          s.mode = "fall";
          s.vy = 0;
          s.pid = null;
        } else {
          if (was) {
            const shift = p.x0 - was.x0;
            s.x += shift;
            s.route.forEach((st) => {
              if (st.kind === "walk" && st.pid === s.pid) {
                st.from += shift;
                st.to += shift;
              }
            });
          }
          s.y = p.y;
          s.x = Math.max(p.x0, Math.min(p.x1, s.x));
        }
      }
      prev = byId;

      // 2. the statechart's current wish
      const state = leafState(actor.getSnapshot().value);
      if (state !== s.state) {
        s.state = state;
        plan(platforms);
      } else if (state === "chase" && now > replanAt) {
        replanAt = now + 350;
        const c = cursor.current;
        const surface = c && (surfaceBelow(platforms, c.x, c.y) ?? platforms[0]);
        if (surface && s.goal?.key !== `${surface.id}:${Math.round(c!.x / 40)}`) plan(platforms);
      } else if (state === "toFood" && !s.goal && s.mode === "stand") plan(platforms);
      else if ((state === "wander" || state === "chase" || state === "toFood") && s.goal && !s.route.length && s.mode === "stand") goTo(platforms, s.goal);

      // 3. cursor: notice it, or lose interest
      const c = cursor.current;
      const dist = c ? Math.hypot(c.x - s.x, c.y - (s.y - s.width * 0.3)) : Infinity;
      if (c && now - c.at > 6000) cursor.current = null;
      if (dist < NOTICE_PX && (state === "idle" || state === "sit" || state === "groom" || state === "wander")) actor.send({ type: "CURSOR_MOVE" });
      else if ((state === "chase" || state === "watch") && dist > LOSE_PX) actor.send({ type: "CURSOR_LEFT" });
      else if (state === "watch" && c) {
        s.dir = c.x >= s.x ? 1 : -1;
        if (Math.abs(c.x - s.x) > s.width * 1.4) actor.send({ type: "CURSOR_MOVE" });
      }

      // 4. move
      let moving = false;
      if (s.mode === "fall") {
        const from = s.y;
        s.vy += GRAVITY * dt;
        s.y += s.vy * dt;
        const ground = surfaceBelow(platforms, s.x, from) ?? platforms[0];
        if (s.y >= ground.y) {
          s.y = ground.y;
          s.pid = ground.id;
          s.mode = "stand";
          s.vy = 0;
          if (s.goal) goTo(platforms, s.goal);
        }
      } else if (s.route.length && s.i < s.route.length) {
        const step = s.route[s.i];
        if (step.kind === "walk") {
          s.mode = "walk";
          const speed = state === "wander" ? 75 : 190;
          const d = step.to - s.x;
          const go = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
          if (Math.abs(d) > 0.5) s.dir = d > 0 ? 1 : -1;
          s.x += go;
          s.phase += Math.abs(go) / (s.width * 0.11);
          moving = true;
          if (Math.abs(step.to - s.x) < 0.6) {
            s.i++;
            s.mode = "stand";
          }
        } else {
          if (s.mode !== "jump") {
            s.mode = "jump";
            s.t = 0;
            s.arc = jumpArc(step.from, step.to, GRAVITY);
            s.dir = step.to.x >= step.from.x ? 1 : -1;
            s.pid = null;
          }
          s.t += dt;
          const p = s.arc!.at(s.t);
          s.x = p.x;
          s.y = p.y;
          s.vy = p.vy;
          moving = true;
          if (s.t >= s.arc!.duration) {
            s.mode = "stand";
            s.pid = step.to.pid;
            s.vy = 0;
            s.i++;
          }
        }
        if (s.i >= s.route.length) arrive();
      } else if (s.mode === "walk") s.mode = "stand";

      // 5. kibble falls and lands on the first ledge below it
      for (const k of food.current) {
        if (k.pid) {
          const p = byId.get(k.pid);
          if (p) {
            k.y = p.y;
            k.x = p.x0 + k.dx;
            continue;
          }
          k.pid = null;
        }
        const from = k.y;
        k.vy += GRAVITY * 0.6 * dt;
        k.y += k.vy * dt;
        const surface = surfaceBelow(platforms, k.x, from) ?? platforms[0];
        if (k.y >= surface.y) {
          k.y = surface.y;
          k.pid = surface.id;
          k.dx = k.x - surface.x0;
          k.vy = 0;
          actor.send({ type: "FOOD_SEEN" });
        }
      }

      // 6. pose
      s.pose =
        s.mode === "jump" || s.mode === "fall"
          ? "jump"
          : moving
            ? "walk"
            : ({ idle: "stand", wander: "stand", chase: "stand", toFood: "stand", watch: "sit", sit: "sit", groom: "groom", hungry: "hungry", eating: "eat", purr: "purr", asleep: "sleep" } as const)[state];

      render();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(hungerTimer);
      if (channel) supabase?.removeChannel(channel);
      ateSub.unsubscribe();
      removeEventListener("mochi:treat", onTreat);
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      removeEventListener("resize", onResize);
    };
  }, []);

  if (!on) return null;
  const s = sim.current;
  const w = s.width;
  const h = (w * SPRITE_H) / SPRITE_W;
  const ax = ((s.dir === 1 ? ANCHOR.x : SPRITE_W - ANCHOR.x) / SPRITE_W) * w;
  const ay = (ANCHOR.y / SPRITE_H) * h;
  const label = { sit: "sitting", watch: "watching you", groom: "grooming", hungry: "hungry", eating: "eating", purr: "purring", asleep: "asleep", chase: "chasing your cursor", toFood: "going for food", wander: "wandering", idle: "looking around" }[s.state];

  return (
    <div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden">
      {food.current.map((k) => (
        <svg key={k.id} width={10} height={10} viewBox="-5 -5 10 10" className="absolute" style={{ left: k.x - 5, top: k.y - 9 }} aria-hidden>
          <circle r={3.6} fill="#E9B98A" stroke="var(--color-line)" strokeWidth={1.2} />
        </svg>
      ))}
      <button
        type="button"
        onClick={() => mochi().send({ type: "PET" })}
        aria-label={`Mochi the cat, ${label}. Pet her`}
        className="pointer-events-auto absolute cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-line"
        style={{ left: s.x - ax, top: s.y - ay, width: w, height: h, transform: "translateZ(0)" }}
      >
        <MochiSprite pose={s.pose} phase={s.phase} vy={s.vy} dir={s.dir} width={w} />
      </button>
    </div>
  );
}
