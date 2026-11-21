"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePushes } from "@/components/building/useLivePushes";
import { KINDS, type FileKind } from "@/lib/file-kinds";
import { DEFAULT_FLOCK, stepFlock, type Fish } from "@/lib/pond/flock.ts";
import { KOI_COLOURS, koiFor, type KoiLook } from "@/lib/pond/koi.ts";
import { commitTitle, doorOfPush, seeded, type PushRow } from "@/lib/pushes";
import type { SkyPhase } from "@/lib/sky";
import { LOOKS, lookForSky, type LookId, type PondLook } from "./looks";
import { Water } from "./water";

/**
 * Door 4 · the commit pond. Every push is a koi; each day's koi school
 * together. Three layers, back to front:
 *   1. the pond floor, painted once per look on a 2D canvas;
 *   2. the GPU water (water.ts), which draws that floor through the moving
 *      surface: ripples bend it and focus light into caustics;
 *   3. a crisp 2D layer for the koi, lily pads and lanterns, so the water
 *      never blurs the fish.
 * Koi leave soft wakes in the water, clicks make ripples they flee from, and
 * a new push drops a new koi in with a splash, live.
 */

type Koi = { fish: Fish; look: KoiLook; push: PushRow; phase: number; born: number };
type Stats = { koi: number; schools: number; checks: number; simMs: number; fps: number; gpu: boolean };

const PAD_COUNT = 7;

function makeKoi(push: PushRow, w: number, h: number, born = 0): Koi | null {
  const door = doorOfPush(push);
  if (door == null) return null;
  const base = koiFor(push, door);
  // koi scale with the pond: about 1.4× on a wide desktop pond, smaller on phones
  const look = { ...base, length: Math.round(base.length * Math.min(1.5, Math.max(0.9, w / 640))) };
  const r = seeded(`${push.sha ?? push.delivery_id}:spawn`);
  const a = r() * Math.PI * 2;
  return {
    fish: { x: 60 + r() * (w - 120), y: 60 + r() * (h - 120), vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, school: door },
    look,
    push,
    phase: look.phase,
    born,
  };
}

/** Floor of the pond: gradient plus a scatter of pebbles (they're what makes refraction visible). */
function paintFloor(cv: HTMLCanvasElement, w: number, h: number, look: PondLook) {
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, look.floor[0]);
  g.addColorStop(1, look.floor[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const r = seeded("pond-floor");
  c.fillStyle = look.pebbles;
  for (let i = 0; i < (w * h) / 900; i++) {
    c.beginPath();
    c.ellipse(r() * w, r() * h, 2 + r() * 6, 1.5 + r() * 4, r() * 3, 0, Math.PI * 2);
    c.fill();
  }
  if (look.id === "ink") {
    c.strokeStyle = "rgba(158,59,76,0.12)";
    c.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const x = r() * w;
      const y = r() * h;
      for (let k = 1; k <= 3; k++) {
        c.beginPath();
        c.arc(x, y, k * 18 + r() * 8, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
  if (look.id === "lantern") {
    for (let i = 0; i < (w * h) / 6000; i++) {
      c.fillStyle = `rgba(255,246,224,${0.2 + r() * 0.5})`;
      c.fillRect(r() * w, r() * h, 1.6, 1.6);
    }
  }
}

function drawKoi(c: CanvasRenderingContext2D, k: Koi, look: PondLook, hot: boolean) {
  const { fish: f, look: kl } = k;
  const L = kl.length;
  const N = 9;
  // the spine: a travelling sine wave, stronger toward the tail
  const spine: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    spine.push([-u * L, Math.sin(k.phase - u * 2.6) * u * u * L * 0.16]);
  }
  // body half-width along the spine: round head, full shoulders, slim tail stem
  const half = (u: number) => L * 0.21 * (u < 0.22 ? Math.sqrt(u / 0.22) * 0.92 + 0.08 : Math.pow(1 - (u - 0.22) / 0.78, 0.85) * 0.94 + 0.06);
  const side = (sign: number) => spine.map(([x, y], i): [number, number] => [x, y + sign * half(i / (N - 1))]);
  const outline = () => {
    const a = side(-1);
    const b = side(1).reverse();
    const pts = [...a, ...b];
    c.beginPath();
    c.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    for (let i = 1; i < pts.length; i++) {
      const n = pts[(i + 1) % pts.length];
      c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + n[0]) / 2, (pts[i][1] + n[1]) / 2);
    }
    c.closePath();
  };
  const tip = spine[N - 1];
  const stem = spine[N - 2];
  const flick = Math.sin(k.phase - 2.6) * L * 0.07;
  const tail = () => {
    // a forked fan, hinged at the end of the body
    const dx = tip[0] - stem[0];
    const dy = tip[1] - stem[1];
    const a = Math.atan2(dy, dx);
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const at = (along: number, across: number): [number, number] => [tip[0] + ux * along + nx * across, tip[1] + uy * along + ny * across + flick];
    const p1 = at(L * 0.3, -L * 0.2), p2 = at(L * 0.18, 0), p3 = at(L * 0.3, L * 0.2);
    c.beginPath();
    c.moveTo(stem[0], stem[1] - L * 0.03);
    c.quadraticCurveTo(...at(L * 0.12, -L * 0.12), p1[0], p1[1]);
    c.quadraticCurveTo(...at(L * 0.2, -L * 0.05), p2[0], p2[1]);
    c.quadraticCurveTo(...at(L * 0.2, L * 0.05), p3[0], p3[1]);
    c.quadraticCurveTo(...at(L * 0.12, L * 0.12), stem[0], stem[1] + L * 0.03);
    c.closePath();
  };
  const fins = () => {
    const [x, y] = spine[2];
    const w = half(0.25);
    const flap = 0.5 + Math.sin(k.phase * 1.3) * 0.25;
    c.beginPath();
    c.ellipse(x - L * 0.05, y - w - L * 0.05, L * 0.12, L * 0.05, -flap, 0, Math.PI * 2);
    c.ellipse(x - L * 0.05, y + w + L * 0.05, L * 0.12, L * 0.05, flap, 0, Math.PI * 2);
  };

  c.save();
  c.translate(f.x, f.y);
  c.rotate(Math.atan2(f.vy, f.vx));
  if (look.glow) {
    c.shadowColor = kl.patches[0].colour;
    c.shadowBlur = 16;
  }
  // fins and tail are a little see-through, like real koi fins
  c.globalAlpha = 0.82;
  c.fillStyle = look.koiBase;
  fins();
  c.fill();
  tail();
  c.fill();
  c.globalAlpha = 1;
  outline();
  c.fill();
  c.shadowBlur = 0;
  // colour patches, clipped to the body
  c.save();
  outline();
  c.clip();
  for (const p of kl.patches) {
    const at = spine[Math.min(N - 2, Math.round(p.at * (N - 1)))];
    c.fillStyle = p.colour;
    c.globalAlpha = look.id === "ink" ? 0.7 : 0.95;
    c.beginPath();
    c.ellipse(at[0], at[1] + p.across * L * 0.16, L * 0.26 * p.size, L * 0.17 * p.size, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.globalAlpha = 1;
  if (look.koiInk || hot) {
    c.strokeStyle = look.koiInk ?? "rgba(255,255,255,0.95)";
    c.lineWidth = hot ? 2.2 : 1.2;
    outline();
    c.stroke();
    tail();
    c.stroke();
    if (look.koiInk) {
      fins();
      c.lineWidth = 0.9;
      c.stroke();
    }
  }
  // eyes
  c.fillStyle = look.id === "lantern" ? "#3a2f55" : "#2b2226";
  c.beginPath();
  c.arc(-L * 0.07, -L * 0.075, Math.max(1, L * 0.035), 0, Math.PI * 2);
  c.arc(-L * 0.07, L * 0.075, Math.max(1, L * 0.035), 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export function Pond({ initialPushes, phase }: { initialPushes: PushRow[]; phase: SkyPhase }) {
  const { pushes } = useLivePushes(initialPushes);
  const box = useRef<HTMLDivElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [choice, setChoice] = useState<LookId | "sky">("sky");
  const lookId: LookId = choice === "sky" ? lookForSky(phase) : choice;
  const look = LOOKS[lookId];
  const [hover, setHover] = useState<Koi | null>(null);
  const hoverRef = useRef<Koi | null>(null);
  hoverRef.current = hover;
  const [stats, setStats] = useState<Stats>({ koi: 0, schools: 0, checks: 0, simMs: 0, fps: 0, gpu: false });

  const koi = useRef<Koi[]>([]);
  const seen = useRef(new Set<string>());
  const state = useRef({ mouse: null as { x: number; y: number } | null, ripples: [] as { x: number; y: number; t: number }[], blooms: [] as { x: number; y: number; t: number }[] });
  const water = useRef<Water | null>(null);
  const floor = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas")), []);

  // size: 16:10 on wide screens, 4:5 on phones
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      setSize({ w, h: Math.round(w < 640 ? w * 1.25 : w * 0.62) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pushes → koi (new ones after the first load splash in)
  useEffect(() => {
    if (!size.w) return;
    const first = seen.current.size === 0;
    for (const p of pushes) {
      if (seen.current.has(p.delivery_id)) continue;
      seen.current.add(p.delivery_id);
      const k = makeKoi(p, size.w, size.h, first ? 0 : performance.now());
      if (!k) continue;
      koi.current.push(k);
      if (!first) {
        water.current?.drop(k.fish.x / size.w, k.fish.y / size.h, 1.1, 4);
        state.current.blooms.push({ x: k.fish.x, y: k.fish.y, t: 0 });
      }
    }
  }, [pushes, size.w, size.h]);

  // the GPU water, rebuilt when the pond's shape changes
  useEffect(() => {
    const cv = glCanvas.current;
    if (!cv || !size.w) return;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    if (!water.current) water.current = Water.create(cv, 256, Math.round((256 * size.h) / size.w));
    return () => {
      water.current?.dispose();
      water.current = null;
    };
  }, [size.w, size.h]);

  useEffect(() => {
    if (floor && size.w) paintFloor(floor, size.w, size.h, look);
  }, [floor, size.w, size.h, look]);

  // the loop
  useEffect(() => {
    const cv = top.current;
    if (!cv || !size.w || !floor) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const c = cv.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pr = seeded("pads");
    const padScale = Math.min(1.15, Math.max(0.55, size.w / 900)); // lily pads shrink with small ponds
    const pads = Array.from({ length: PAD_COUNT }, () => ({ x: pr() * size.w, y: pr() * size.h, r: (22 + pr() * 26) * padScale, a: pr() * 6.28 }));
    const lanterns = [0.15, 0.55, 0.82].map((u, i) => ({ x: u * size.w, y: (0.2 + ((i * 0.37) % 0.6)) * size.h, ph: i * 2 }));
    let raf = 0;
    let last = performance.now();
    let wake = 0;
    let acc = 0;
    let frames = 0;
    let checks = 0;
    let simMs = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = state.current;
      const all = koi.current;
      const t0 = performance.now();
      if (!reduce) {
        s.ripples.forEach((r) => (r.t += dt));
        s.ripples = s.ripples.filter((r) => r.t < 1.4);
        checks = stepFlock(
          all.map((k) => k.fish),
          size.w,
          size.h,
          dt,
          DEFAULT_FLOCK,
          {
            target: s.mouse ? { ...s.mouse, pull: 45, range: 260 } : null,
            ripples: s.ripples.map((r) => ({ x: r.x, y: r.y, radius: r.t * 220, strength: 520 * (1 - r.t / 1.4) })),
          },
        );
        for (const k of all) k.phase += dt * (3 + Math.hypot(k.fish.vx, k.fish.vy) / 18);
      }
      simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;

      const w = water.current;
      if (w) {
        wake += dt;
        if (wake > 0.12 && !reduce) {
          wake = 0;
          for (const k of all)
            if (Math.random() < 0.3) {
              const a = Math.atan2(k.fish.vy, k.fish.vx);
              const tx = k.fish.x - Math.cos(a) * k.look.length * 0.9;
              const ty = k.fish.y - Math.sin(a) * k.look.length * 0.9;
              w.drop(tx / size.w, ty / size.h, 0.012, 1.4);
            }
        }
        if (!reduce) w.step(2);
        w.render(floor, look.water);
      }

      // crisp layer
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size.w, size.h);
      if (!w) c.drawImage(floor, 0, 0, size.w, size.h);
      for (const k of all) {
        c.fillStyle = look.shadow;
        c.beginPath();
        c.ellipse(k.fish.x + 8, k.fish.y + 12, k.look.length * 0.5, k.look.length * 0.18, Math.atan2(k.fish.vy, k.fish.vx), 0, Math.PI * 2);
        c.fill();
      }
      for (const k of all) drawKoi(c, k, look, hoverRef.current === k);
      for (const p of pads) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.a);
        c.fillStyle = look.pad;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, p.r, 0.3, Math.PI * 2 - 0.15);
        c.closePath();
        c.fill();
        if (look.padInk) {
          c.strokeStyle = look.padInk;
          c.lineWidth = 1.3;
          c.stroke();
        }
        c.restore();
      }
      if (look.id === "lantern")
        for (const l of lanterns) {
          const y = l.y + Math.sin(now / 1000 + l.ph) * 4;
          const g = c.createRadialGradient(l.x, y, 0, l.x, y, 60);
          g.addColorStop(0, "rgba(251,227,176,0.42)");
          g.addColorStop(1, "rgba(251,227,176,0)");
          c.fillStyle = g;
          c.fillRect(l.x - 60, y - 60, 120, 120);
          c.fillStyle = "#FBE3B0";
          c.strokeStyle = "#9E3B4C";
          c.lineWidth = 1.3;
          c.beginPath();
          c.moveTo(l.x - 11, y + 8);
          c.lineTo(l.x + 11, y + 8);
          c.lineTo(l.x + 7, y - 9);
          c.lineTo(l.x - 7, y - 9);
          c.closePath();
          c.fill();
          c.stroke();
        }
      // a new koi arrives inside a widening ring
      s.blooms.forEach((b) => (b.t += dt));
      s.blooms = s.blooms.filter((b) => b.t < 2);
      for (const b of s.blooms) {
        c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - b.t / 2)})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(b.x, b.y, 10 + b.t * 60, 0, Math.PI * 2);
        c.stroke();
      }

      acc += dt;
      frames++;
      if (acc > 0.5) {
        const schools = new Set(all.map((k) => k.fish.school)).size;
        setStats({ koi: all.length, schools, checks, simMs: Math.round(simMs * 100) / 100, fps: Math.round(frames / acc), gpu: !!w });
        acc = 0;
        frames = 0;
      }
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, look, floor]);

  const local = (e: React.PointerEvent) => {
    const b = top.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Pond look">
        {(["sky", "garden", "ink", "lantern"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={choice === id}
            onClick={() => setChoice(id)}
            className={`rounded-full border border-line/30 px-3.5 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-glass ${choice === id ? "bg-glass" : ""}`}
          >
            {id === "sky" ? `Follow the sky (${LOOKS[lookForSky(phase)].label.toLowerCase()})` : LOOKS[id].label}
          </button>
        ))}
      </div>

      <div ref={box} className="relative w-full overflow-hidden rounded-xl border-[1.5px] border-line" style={{ height: size.h || undefined, aspectRatio: size.h ? undefined : "16 / 10" }}>
        <canvas ref={glCanvas} className="absolute inset-0 h-full w-full" aria-hidden />
        <canvas
          ref={top}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          role="img"
          aria-label={`A koi pond with ${stats.koi} koi, one for each push, schooling by day. Click to make ripples.`}
          onPointerMove={(e) => {
            const p = local(e);
            state.current.mouse = p;
            const hit = koi.current.find((k) => Math.hypot(k.fish.x - p.x, k.fish.y - p.y) < k.look.length * 0.7) ?? null;
            if (hit !== hover) setHover(hit);
          }}
          onPointerLeave={() => {
            state.current.mouse = null;
            setHover(null);
          }}
          onPointerDown={(e) => {
            const p = local(e);
            state.current.ripples.push({ ...p, t: 0 });
            water.current?.drop(p.x / size.w, p.y / size.h, 0.7, 3.2);
          }}
        />
        {hover && (
          <div
            className="card-in pointer-events-none absolute z-10 w-max max-w-64 rounded-md border border-line/25 bg-paper px-3.5 py-2.5 text-line shadow-[0_12px_32px_-12px_rgba(78,30,40,0.35)]"
            style={{ left: Math.min(size.w - 270, Math.max(8, hover.fish.x + 18)), top: Math.max(8, hover.fish.y - 70) }}
          >
            <p className="font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70">
              No. {hover.fish.school} · {hover.push.repo ?? "push"}
            </p>
            <p className="mt-1 font-serif text-[15px] leading-snug">{commitTitle(hover.push)}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 font-sans text-[11px]">
              {Object.entries(hover.push.files ?? {}).map(([k, n]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: KOI_COLOURS[k as FileKind] ?? KOI_COLOURS.other }} />
                  {n} {KINDS[k as FileKind]?.label ?? k}
                </span>
              ))}
            </p>
            {hover.push.sha && <p className="mt-1 font-mono text-[11px] opacity-60">{hover.push.sha.slice(0, 7)}</p>}
          </div>
        )}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs">
        {[
          ["Koi", stats.koi],
          ["Schools (days)", stats.schools],
          ["Neighbour checks / frame", stats.checks.toLocaleString()],
          ["Flocking", `${stats.simMs} ms`],
          ["Water", stats.gpu ? "GPU, 256-wide grid" : "off (no WebGL2 floats)"],
          ["FPS", stats.fps],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex gap-1.5">
            <dt className="opacity-60">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
