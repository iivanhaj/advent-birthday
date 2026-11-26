"use client";

import { useEffect, useRef, useState } from "react";
import { CAT_X, STEP, buildWorld, decodeReplay, encodeReplay, seedFor, startState, step, type RunState, type World } from "@/lib/run/sim";
import { Painter, type Fx } from "./draw";
import { play, wake } from "./sound";

/**
 * The game loop. The simulation advances in fixed 1/60 s steps however fast
 * the screen refreshes (an accumulator collects real time and spends it in
 * whole steps), so a run plays the same on a 60 Hz phone and a 144 Hz
 * monitor, and a replay (just the frames where the button went down and up)
 * reproduces it exactly.
 */

type Phase = "ready" | "run" | "over" | "replay";
type Result = { score: number; stars: number; cakes: number; metres: number; why: RunState["over"] };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pretty = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const WHY = { fell: "Mochi slipped between the roofs", wall: "Mochi bumped into a wall", bird: "A pigeon got in the way" } as const;

export function RooftopRun({ today }: { today: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState({ score: 0, metres: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [course, setCourse] = useState(today);
  // everything the loop touches lives in a ref, so the loop never waits on React
  const game = useRef({ world: null as World | null, s: null as RunState | null, held: false, pressed: false, toggles: [] as number[], replay: null as number[] | null, k: 0, fx: [] as Fx[], combo: 0, comboAt: -99, bouncedAt: -1, phase: "ready" as Phase, muted: false });

  function reset(date: string, replay: number[] | null) {
    const G = game.current;
    G.world = buildWorld(seedFor(date), 160000);
    G.s = startState(G.world);
    G.toggles = [];
    G.replay = replay;
    G.k = 0;
    G.fx = [];
    G.combo = 0;
    G.bouncedAt = -1;
    G.held = false;
    G.pressed = false;
  }

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(`run-best-${today}`) ?? 0));
      setMuted(localStorage.getItem("run-muted") === "1");
    } catch {
      /* storage off */
    }
    // a replay link: #r=2026-11-26~…
    const code = new URLSearchParams(location.hash.slice(1)).get("r");
    const rep = code ? decodeReplay(code) : null;
    if (rep) {
      setCourse(rep.date);
      reset(rep.date, rep.toggles);
      game.current.phase = "replay";
      setPhase("replay");
    } else reset(today, null);
  }, [today]);

  useEffect(() => {
    game.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const cv = canvas.current!;
    const painter = new Painter(cv);
    painter.resize();
    const ro = new ResizeObserver(() => painter.resize());
    ro.observe(cv);
    let raf = 0, last = performance.now(), acc = 0, hudAt = 0;
    const G = game.current;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!G.world || !G.s) return;
      acc = Math.min(0.25, acc + (now - last) / 1000);
      last = now;
      const live = G.phase === "run" || G.phase === "replay";
      while (live && acc >= STEP && !G.s.over) {
        acc -= STEP;
        let pressed = false, held = G.held;
        if (G.phase === "replay" && G.replay) {
          while (G.k < G.replay.length && G.replay[G.k] === G.s.frame) {
            G.held = !G.held;
            if (G.held) pressed = true;
            G.k++;
          }
          held = G.held;
        } else {
          pressed = G.pressed;
          G.pressed = false;
        }
        step(G.world, G.s, { held, pressed });
        for (const e of G.s.events) {
          const y = G.s.cat.y;
          if (e === "star" || e === "cake") {
            G.combo = G.s.frame - G.comboAt < 90 ? G.combo + 1 : 0;
            G.comboAt = G.s.frame;
            for (let i = 0; i < 10; i++) G.fx.push({ kind: "spark", x: CAT_X + 8, y: y - 24, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 1 });
            G.fx.push({ kind: "text", x: CAT_X + 10, y: y - 46, vx: 0, vy: -0.5, life: 1.2, text: e === "cake" ? "+5" : "+1" });
          }
          if (e === "land") for (let i = 0; i < 3; i++) G.fx.push({ kind: "dust", x: CAT_X - 8 + i * 8, y: y - 2, vx: (i - 1) * 0.6, vy: -0.2, life: 0.8 });
          if (e === "bounce") G.bouncedAt = G.s.frame;
          if (!G.muted) play(e === "star" ? "star" : e, G.combo);
        }
        if (G.s.over) {
          if (!G.muted) play("over");
          const r: Result = { score: G.s.score, stars: G.s.stars, cakes: G.s.cakes, metres: Math.round(G.s.dist / 10), why: G.s.over };
          setResult(r);
          if (G.phase === "run") {
            try {
              const key = `run-best-${today}`;
              if (r.score > Number(localStorage.getItem(key) ?? 0)) localStorage.setItem(key, String(r.score));
              setBest((b) => Math.max(b, r.score));
            } catch {
              /* storage off */
            }
          }
          G.phase = "over";
          setPhase("over");
        }
      }
      for (const f of G.fx) {
        f.x += f.vx;
        f.y += f.vy;
        if (f.kind === "spark") f.vy += 0.12;
        f.life -= 0.025;
      }
      G.fx = G.fx.filter((f) => f.life > 0);
      painter.draw(G.world, G.s, G.fx, now, G.bouncedAt);
      if (now - hudAt > 100) {
        hudAt = now;
        setHud({ score: G.s.score, metres: Math.round(G.s.dist / 10) });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [today]);

  function begin() {
    const G = game.current;
    wake();
    if (G.phase === "over" || G.phase === "replay") {
      setCourse(today);
      reset(today, null);
      history.replaceState(null, "", location.pathname);
    }
    G.phase = "run";
    setPhase("run");
    setResult(null);
  }

  function down() {
    const G = game.current;
    if (G.phase !== "run") return begin();
    if (G.held) return;
    G.held = true;
    G.pressed = true;
    G.toggles.push(G.s!.frame);
  }
  function up() {
    const G = game.current;
    if (G.phase !== "run" || !G.held) return;
    G.held = false;
    G.toggles.push(G.s!.frame);
  }

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      if (!canvas.current?.closest("section")?.contains(document.activeElement) && document.activeElement !== document.body) return;
      e.preventDefault();
      if (!e.repeat) down();
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") up();
    };
    addEventListener("keydown", kd);
    addEventListener("keyup", ku);
    addEventListener("pointerup", up);
    return () => {
      removeEventListener("keydown", kd);
      removeEventListener("keyup", ku);
      removeEventListener("pointerup", up);
    };
  });

  async function share() {
    const url = `${location.origin}${location.pathname}#r=${encodeReplay(course, game.current.toggles)}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "Mochi's rooftop run", text: `Mochi caught ${result?.score} stars on today's rooftops`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* closed */
    }
  }

  function toggleMute() {
    setMuted((m) => {
      try {
        localStorage.setItem("run-muted", m ? "0" : "1");
      } catch {
        /* storage off */
      }
      return !m;
    });
  }

  const card = "pointer-events-auto mx-3 max-w-sm rounded-md border border-line/25 bg-paper/95 px-4 py-3 text-center text-line shadow-[0_18px_40px_-20px_rgba(40,20,50,0.6)] sm:px-6 sm:py-5";
  const btn = "font-sans text-[10.5px] font-medium tracking-[0.16em] uppercase border border-line/55 px-3.5 py-2 transition-colors hover:bg-glass";

  return (
    <div className="relative select-none">
      <canvas
        ref={canvas}
        className="block h-[270px] w-full touch-none rounded-md sm:h-[420px]"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).focus();
          down();
        }}
        tabIndex={0}
        aria-label="Mochi's rooftop run. Press space or tap to jump; hold to jump higher."
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 text-[#fff6ec] sm:p-4">
        <div className="drop-shadow-[0_1px_2px_rgba(40,20,40,.5)]">
          <p className="font-serif text-2xl leading-none italic">★ {hud.score}</p>
          <p className="mt-1 font-sans text-[10px] tracking-[0.18em] whitespace-nowrap uppercase opacity-85">
            {hud.metres} m<span className="hidden sm:inline"> · {phase === "replay" ? `a run on ${pretty(course)}` : `today's rooftops · ${pretty(course)}`}</span>
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 font-sans text-[10px] tracking-[0.18em] whitespace-nowrap uppercase drop-shadow-[0_1px_2px_rgba(40,20,40,.5)]">
          {best > 0 && <span>best ★ {best}</span>}
          <button type="button" onClick={toggleMute} className="underline-offset-2 hover:underline" aria-pressed={!muted}>
            {muted ? "sound off" : "sound on"}
          </button>
        </div>
      </div>

      {phase === "ready" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={card}>
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-70">Today&apos;s rooftops · {pretty(course)}</p>
            <p className="mt-1 font-serif text-2xl italic sm:text-3xl">How far can Mochi go?</p>
            <p className="mx-auto mt-2 hidden max-w-xs font-sans text-xs leading-relaxed opacity-80 sm:block">
              Tap, or press space, to jump; hold for a longer leap. Catch the stars, land on the awnings, mind the pigeons.
            </p>
            <p className="mt-1 font-sans text-[11px] opacity-80 sm:hidden">tap to jump · hold to leap further</p>
            <button type="button" onClick={begin} className={`${btn} mt-3 bg-line text-paper hover:bg-line/90 sm:mt-4`}>
              Start running
            </button>
          </div>
        </div>
      )}
      {phase === "replay" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-serif text-sm text-[#fff6ec] italic drop-shadow-[0_1px_2px_rgba(40,20,40,.6)]">watching someone&apos;s run · tap to play your own</p>
      )}
      {phase === "over" && result && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#2a2449]/25">
          <div className={card}>
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-70">{result.why ? WHY[result.why] : "The end"}</p>
            <p className="mt-1 font-serif text-3xl italic sm:text-4xl">★ {result.score}</p>
            <p className="mt-1 font-sans text-xs opacity-80">
              {result.stars} {result.stars === 1 ? "star" : "stars"}
              {result.cakes > 0 && `, ${result.cakes} ${result.cakes === 1 ? "slice" : "slices"} of cake`} · {result.metres} m{best > 0 && ` · best ★ ${best}`}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={begin} className={`${btn} bg-line text-paper hover:bg-line/90`}>
                Run again
              </button>
              {game.current.toggles.length > 0 && (
                <button type="button" onClick={share} className={btn}>
                  {copied ? "Link copied" : "Share this run"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
