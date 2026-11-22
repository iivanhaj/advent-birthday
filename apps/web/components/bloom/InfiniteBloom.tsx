"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_BLOOM, FLOATS_PER_FLOWER, UP, cameraAt, startFrame, toScreen, walk, type BloomParams } from "@/lib/bloom/bloom.ts";
import type { SkyPhase } from "@/lib/sky";
import { BloomRenderer, type BloomTheme } from "./renderer";

/**
 * The infinite bloom: a flower whose every petal holds a smaller copy of the
 * whole flower, zooming in forever. Each frame:
 *   1. advance the zoom phase t (wrapping 1 → 0, which is seamless);
 *   2. walk the infinite tree for the visible flowers, in Rust/WASM or
 *      TypeScript (and time both, for the race);
 *   3. hand the list to the GPU, which draws every flower in one call.
 */

type Engine = "wasm" | "js";
type Wasm = { memory: WebAssembly.Memory; alloc_out(max: number): number; walk(...a: number[]): number };

const MAX = 400_000;
const themeForSky = (phase: SkyPhase): BloomTheme => (phase === "night" ? "glass" : "ink");

export function InfiniteBloom({ phase }: { phase: SkyPhase }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [themeChoice, setThemeChoice] = useState<BloomTheme | "sky">("sky");
  const theme: BloomTheme = themeChoice === "sky" ? themeForSky(phase) : themeChoice;
  const [params, setParams] = useState<BloomParams>(DEFAULT_BLOOM);
  const [detail, setDetail] = useState(5); // smallest flower drawn, CSS px
  const [engine, setEngine] = useState<Engine>("wasm");
  const [paused, setPaused] = useState(false);
  const [dive, setDive] = useState(0);
  const [stats, setStats] = useState({ flowers: 0, js: 0, wasm: 0, depth: 0, fps: 0, wasmReady: false, gpu: true });
  const live = useRef({ t: 0, depth: 0, speed: 0.12, fade: 1 });
  const wasm = useRef<{ api: Wasm; ptr: number } | null>(null);
  const settings = useRef({ params, detail, engine, paused, dive, theme });
  settings.current = { params, detail, engine, paused, dive, theme };

  // shared links: ?petals=7&ratio=0.3&twist=0.4&theme=glass
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const num = (k: string, lo: number, hi: number) => {
      const v = Number(q.get(k));
      return q.has(k) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
    };
    setParams((p) => ({ ...p, petals: Math.round(num("petals", 5, 9) ?? p.petals), ratio: num("ratio", 0.2, 0.34) ?? p.ratio, twist: num("twist", -1.2, 1.2) ?? p.twist }));
    const t = q.get("theme");
    if (t === "ink" || t === "glass") setThemeChoice(t);
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    q.set("petals", String(params.petals));
    q.set("ratio", params.ratio.toFixed(2));
    q.set("twist", params.twist.toFixed(2));
    if (themeChoice === "sky") q.delete("theme");
    else q.set("theme", themeChoice);
    history.replaceState(null, "", `${location.pathname}?${q}`);
  }, [params, themeChoice]);

  // load the Rust engine
  useEffect(() => {
    let cancelled = false;
    WebAssembly.instantiateStreaming(fetch("/bloom.wasm"))
      .then(({ instance }) => {
        if (cancelled) return;
        const api = instance.exports as unknown as Wasm;
        wasm.current = { api, ptr: api.alloc_out(MAX) };
      })
      .catch(() => setEngine("js"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const renderer = BloomRenderer.create(cv);
    if (!renderer) {
      setStats((s) => ({ ...s, gpu: false }));
      return;
    }
    const jsOut = new Float32Array(MAX * FLOATS_PER_FLOWER);
    const avg = { js: 0, wasm: 0 };
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      const w = el.clientWidth;
      const h = Math.round(w < 640 ? w * 1.05 : w * 0.6);
      el.style.height = `${h}px`;
      cv.width = W = Math.round(w * dpr);
      cv.height = H = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = settings.current;
      const L = live.current;
      if (!s.paused) {
        L.t += dt * L.speed;
        while (L.t >= 1) {
          L.t -= 1;
          L.depth++;
        }
        while (L.t < 0) {
          L.t += 1;
          L.depth = Math.max(0, L.depth - 1);
        }
      }
      const cam = cameraAt(L.t, s.params, W, H, s.dive);
      const start = startFrame(cam, s.params, 3, s.dive);
      const min = s.detail * dpr;
      const args = [s.params.petals, s.params.ratio, s.params.dist, s.params.twist, start.x, start.y, start.size, start.rot, start.level, W, H, min];

      // the race: run both engines, draw with the chosen one
      let t0 = performance.now();
      const nJs = walk(start, s.params, W, H, min, jsOut);
      avg.js = avg.js * 0.9 + (performance.now() - t0) * 0.1;
      let data = jsOut;
      let n = nJs;
      const w = wasm.current;
      if (w) {
        t0 = performance.now();
        const nW = w.api.walk(w.ptr, MAX, ...args);
        avg.wasm = avg.wasm * 0.9 + (performance.now() - t0) * 0.1;
        if (s.engine === "wasm") {
          data = new Float32Array(w.api.memory.buffer, w.ptr, nW * FLOATS_PER_FLOWER);
          n = nW;
        }
      }
      renderer.draw(data, n, { theme: s.theme, petals: s.params.petals, dpr, phase: L.t });

      acc += dt;
      frames++;
      if (acc > 0.5) {
        setStats({ flowers: n, js: Math.round(avg.js * 100) / 100, wasm: Math.round(avg.wasm * 100) / 100, depth: L.depth, fps: Math.round(frames / acc), wasmReady: !!w, gpu: true });
        acc = 0;
        frames = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  /** Click a petal of the flower you're diving toward: the next dive heads into that petal. */
  function steer(e: React.PointerEvent<HTMLCanvasElement>) {
    const cv = canvas.current!;
    const b = cv.getBoundingClientRect();
    const dpr = cv.width / b.width;
    const x = (e.clientX - b.left) * dpr;
    const y = (e.clientY - b.top) * dpr;
    const cam = cameraAt(live.current.t, params, cv.width, cv.height, dive);
    const [rx, ry] = toScreen(cam, 0, 0); // the current flower's centre
    const step = (2 * Math.PI) / params.petals;
    const a = Math.atan2(y - ry, x - rx) - (cam.angle + UP);
    const k = (((Math.round(a / step) % params.petals) + params.petals) % params.petals);
    if (k === dive) return;
    // a quick fade hides the jump to the new dive path
    cv.style.opacity = "0";
    setTimeout(() => {
      setDive(k);
      live.current.t = 0;
      cv.style.opacity = "1";
    }, 160);
  }

  const pill = "rounded-full border border-line/30 px-3.5 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-glass";
  const slider = (label: string, value: number, min: number, max: number, stepv: number, onChange: (v: number) => void, show: string) => (
    <label className="flex items-center gap-2 font-sans text-xs">
      <span className="w-20 opacity-70">{label}</span>
      <input type="range" min={min} max={max} step={stepv} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-32" />
      <span className="w-12 tabular-nums">{show}</span>
    </label>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["sky", "ink", "glass"] as const).map((id) => (
          <button key={id} type="button" aria-pressed={themeChoice === id} onClick={() => setThemeChoice(id)} className={`${pill} ${themeChoice === id ? "bg-glass" : ""}`}>
            {id === "sky" ? `Follow the sky (${themeForSky(phase) === "ink" ? "ink" : "glass"})` : id === "ink" ? "Fine-line ink" : "Glass at night"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line/20" aria-hidden />
        <button type="button" className={pill} onClick={() => setPaused((p) => !p)}>
          {paused ? "Play" : "Pause"}
        </button>
      </div>

      <div ref={box} className={`relative w-full overflow-hidden rounded-xl border-[1.5px] border-line ${theme === "ink" ? "paper-grain" : "bg-[#0b0918]"}`}>
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full cursor-pointer transition-opacity duration-150"
          role="img"
          aria-label="A flower whose every petal holds a smaller copy of the whole flower, zooming in forever. Click a petal to dive into it; scroll to change speed."
          onPointerDown={steer}
          onWheel={(e) => {
            live.current.speed = Math.max(-0.6, Math.min(0.9, live.current.speed + (e.deltaY > 0 ? 0.05 : -0.05)));
          }}
        />
        {!stats.gpu && <p className="absolute inset-0 grid place-items-center font-sans text-sm">This needs WebGL2, which this browser doesn&rsquo;t have.</p>}
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {slider("Petals", params.petals, 5, 9, 1, (v) => setParams((p) => ({ ...p, petals: v })), String(params.petals))}
        {slider("Nesting", params.ratio, 0.2, 0.34, 0.01, (v) => setParams((p) => ({ ...p, ratio: v })), `${Math.round(params.ratio * 100)}%`)}
        {slider("Twist", params.twist, -1.2, 1.2, 0.05, (v) => setParams((p) => ({ ...p, twist: v })), `${Math.round((params.twist * 180) / Math.PI)}°`)}
        {slider("Detail", 6 - detail, 0, 5.5, 0.25, (v) => setDetail(6 - v), detail < 1 ? `${detail.toFixed(2)} px` : `${detail.toFixed(1)} px`)}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-sans text-xs opacity-70">Tree walk in</span>
        {(["wasm", "js"] as const).map((id) => (
          <button key={id} type="button" aria-pressed={engine === id} disabled={id === "wasm" && !stats.wasmReady} onClick={() => setEngine(id)} className={`${pill} ${engine === id ? "bg-glass" : ""} disabled:opacity-40`}>
            {id === "wasm" ? "Rust → WebAssembly" : "TypeScript"}
          </button>
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs">
        {[
          ["Flowers drawn", stats.flowers.toLocaleString()],
          ["Walk, TypeScript", `${stats.js} ms`],
          ["Walk, Rust/WASM", stats.wasmReady ? `${stats.wasm} ms` : "loading"],
          ["Depth", stats.depth],
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
