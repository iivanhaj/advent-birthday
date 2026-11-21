"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_FLOCK, stepFlock, type Fish } from "@/lib/pond/flock.ts";

/**
 * Stress mode: thousands of koi, CPU against GPU.
 *
 * GPU (WebGPU): a compute shader runs boids for every koi in parallel. Each
 * workgroup of 256 threads walks the whole school in tiles of 256, staged in
 * fast workgroup memory, so every koi is compared with every other koi
 * (n² pairs: 100 million at 10,000 koi) every frame. A render pipeline then
 * draws all of them in one instanced draw call, reading positions straight
 * from the same GPU buffer: nothing is copied back to the CPU.
 *
 * CPU: the same rules through the spatial hash (lib/pond/flock.ts), drawn
 * with Canvas 2D. Fewer comparisons, but one at a time.
 */

const SCHOOLS = 8;
const COLOURS = ["#E58FA8", "#F2C45A", "#6FB5A5", "#9E8BD6", "#7FA9D1", "#E8945A", "#8DBF6A", "#D9879C"];

/* Minimal WebGPU typings: just what this file uses (no @webgpu/types dependency). */
/* eslint-disable @typescript-eslint/no-explicit-any */
type GPU = { requestAdapter(): Promise<any>; getPreferredCanvasFormat(): string };
const gpuApi = (): GPU | undefined => (typeof navigator !== "undefined" ? (navigator as unknown as { gpu?: GPU }).gpu : undefined);

const COMPUTE = /* wgsl */ `
struct Fish { pos: vec2f, vel: vec2f };
struct Params { count: f32, dt: f32, w: f32, h: f32, mouse: vec2f, mouseOn: f32, pad: f32 };
@group(0) @binding(0) var<storage, read> src: array<Fish>;
@group(0) @binding(1) var<storage, read_write> dst: array<Fish>;
@group(0) @binding(2) var<uniform> P: Params;
var<workgroup> tile: array<Fish, 256>;

const SIGHT = 34.0;
const PERSONAL = 9.0;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) li: u32) {
  let n = u32(P.count);
  let i = gid.x;
  let me = src[min(i, n - 1u)];
  let school = i % ${SCHOOLS}u;
  var sep = vec2f(0.0); var coh = vec2f(0.0); var ali = vec2f(0.0); var k = 0.0;
  let tiles = (n + 255u) / 256u;
  for (var t = 0u; t < tiles; t++) {
    let j = t * 256u + li;
    if (j < n) { tile[li] = src[j]; }
    workgroupBarrier();
    for (var m = 0u; m < 256u; m++) {
      let jj = t * 256u + m;
      if (jj >= n || jj == i) { continue; }
      let o = tile[m];
      let d = o.pos - me.pos;
      let d2 = dot(d, d);
      if (d2 < PERSONAL * PERSONAL && d2 > 0.0001) {
        let dist = sqrt(d2);
        sep -= d / dist * (PERSONAL - dist);
      }
      if (jj % ${SCHOOLS}u == school && d2 < SIGHT * SIGHT) {
        coh += o.pos; ali += o.vel; k += 1.0;
      }
    }
    workgroupBarrier();
  }
  if (i >= n) { return; }
  var acc = sep * 5.0;
  if (k > 0.0) { acc += (coh / k - me.pos) * 0.45 + (ali / k - me.vel) * 0.9; }
  if (P.mouseOn > 0.5) {
    let d = P.mouse - me.pos; let l = length(d);
    if (l < 220.0 && l > 1.0) { acc += d / l * 60.0; }
  }
  let m = 30.0;
  if (me.pos.x < m) { acc.x += (m - me.pos.x) * 4.0; }
  if (me.pos.x > P.w - m) { acc.x -= (me.pos.x - (P.w - m)) * 4.0; }
  if (me.pos.y < m) { acc.y += (m - me.pos.y) * 4.0; }
  if (me.pos.y > P.h - m) { acc.y -= (me.pos.y - (P.h - m)) * 4.0; }
  var v = me.vel + acc * P.dt;
  let s = max(length(v), 0.001);
  v = v / s * clamp(s, 25.0, 80.0);
  dst[i] = Fish(me.pos + v * P.dt, v);
}`;

const RENDER = /* wgsl */ `
struct Fish { pos: vec2f, vel: vec2f };
struct Params { count: f32, dt: f32, w: f32, h: f32, mouse: vec2f, mouseOn: f32, pad: f32 };
@group(0) @binding(0) var<storage, read> fish: array<Fish>;
@group(0) @binding(1) var<uniform> P: Params;
struct Out { @builtin(position) pos: vec4f, @location(0) col: vec3f };
const SHAPE = array<vec2f, 9>(
  vec2f(1.0, 0.0), vec2f(0.1, 0.45), vec2f(0.1, -0.45),
  vec2f(0.1, 0.45), vec2f(-0.9, 0.0), vec2f(0.1, -0.45),
  vec2f(-0.7, 0.0), vec2f(-1.4, 0.45), vec2f(-1.4, -0.45));
const COLS = array<vec3f, ${SCHOOLS}>(${COLOURS.map((c) => {
  const v = [1, 3, 5].map((o) => (parseInt(c.slice(o, o + 2), 16) / 255).toFixed(3));
  return `vec3f(${v.join(",")})`;
}).join(",")});
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out {
  let f = fish[ii];
  var shape = SHAPE;
  var cols = COLS;
  let dir = normalize(f.vel + vec2f(0.0001, 0.0));
  let p = shape[vi] * 3.6;
  let world = f.pos + vec2f(p.x * dir.x - p.y * dir.y, p.x * dir.y + p.y * dir.x);
  var o: Out;
  o.pos = vec4f(world.x / P.w * 2.0 - 1.0, 1.0 - world.y / P.h * 2.0, 0.0, 1.0);
  o.col = cols[ii % ${SCHOOLS}u] * select(0.82, 1.0, vi < 3u); // each school its own colour; tails a shade darker
  return o;
}
@fragment fn fs(i: Out) -> @location(0) vec4f { return vec4f(i.col, 1.0); }`;

function spawn(n: number, w: number, h: number): Fish[] {
  let s = 12345;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, i) => {
    const a = r() * Math.PI * 2;
    return { x: 30 + r() * (w - 60), y: 30 + r() * (h - 60), vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, school: i % SCHOOLS };
  });
}

type Mode = "gpu" | "cpu";

export function StressPond() {
  const [mode, setMode] = useState<Mode>("gpu");
  const [count, setCount] = useState(10000);
  const [gpuOk, setGpuOk] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ fps: 0, ms: 0, pairs: 0 });
  const [running, setRunning] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const gpuCanvas = useRef<HTMLCanvasElement>(null);
  const cpuCanvas = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const api = gpuApi();
    if (!api) return setGpuOk(false);
    api.requestAdapter().then((a) => setGpuOk(!!a)).catch(() => setGpuOk(false));
  }, []);
  useEffect(() => {
    if (gpuOk === false) setMode("cpu");
  }, [gpuOk]);

  useEffect(() => {
    if (!running) return;
    const el = wrap.current!;
    const w = el.clientWidth;
    const h = Math.round(w * (w < 640 ? 1.1 : 0.55));
    let raf = 0;
    let stop = false;
    let frames = 0;
    let acc = 0;
    let last = performance.now();
    let ms = 0;
    const report = (dt: number, pairs: number) => {
      frames++;
      acc += dt;
      if (acc > 0.5) {
        setStats({ fps: Math.round(frames / acc), ms: Math.round(ms * 100) / 100, pairs });
        frames = 0;
        acc = 0;
      }
    };

    if (mode === "cpu") {
      const cv = cpuCanvas.current!;
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d")!;
      const fish = spawn(count, w, h);
      const params = { ...DEFAULT_FLOCK, sight: 34, personal: 9, minSpeed: 25, maxSpeed: 80, margin: 30 };
      const tick = (now: number) => {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        const t0 = performance.now();
        const pairs = stepFlock(fish, w, h, dt, params, { target: mouse.current ? { ...mouse.current, pull: 60, range: 220 } : null });
        ms = ms * 0.9 + (performance.now() - t0) * 0.1;
        c.fillStyle = "#1f4a3d";
        c.fillRect(0, 0, w, h);
        for (const f of fish) {
          const a = Math.atan2(f.vy, f.vx);
          const cs = Math.cos(a) * 3.6, sn = Math.sin(a) * 3.6;
          c.fillStyle = COLOURS[f.school];
          c.beginPath();
          c.moveTo(f.x + cs, f.y + sn);
          c.lineTo(f.x - cs * 0.9 - sn * 0.45, f.y - sn * 0.9 + cs * 0.45);
          c.lineTo(f.x - cs * 0.9 + sn * 0.45, f.y - sn * 0.9 - cs * 0.45);
          c.fill();
        }
        report(dt, pairs);
        if (!stop) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        stop = true;
        cancelAnimationFrame(raf);
      };
    }

    // ---- WebGPU ----
    let device: any = null;
    (async () => {
      const api = gpuApi()!;
      const adapter = await api.requestAdapter();
      if (!adapter || stop) return;
      device = await adapter.requestDevice();
      const cv = gpuCanvas.current!;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("webgpu") as any;
      const format = api.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: "opaque" });
      const U = (globalThis as any).GPUBufferUsage;
      const data = new Float32Array(count * 4);
      spawn(count, w, h).forEach((f, i) => data.set([f.x, f.y, f.vx, f.vy], i * 4));
      const bufs = [0, 1].map(() => device.createBuffer({ size: data.byteLength, usage: U.STORAGE | U.COPY_DST | U.VERTEX }));
      device.queue.writeBuffer(bufs[0], 0, data);
      const params = device.createBuffer({ size: 32, usage: U.UNIFORM | U.COPY_DST });
      const compute = device.createComputePipeline({ layout: "auto", compute: { module: device.createShaderModule({ code: COMPUTE }), entryPoint: "main" } });
      const renderMod = device.createShaderModule({ code: RENDER });
      const render = device.createRenderPipeline({ layout: "auto", vertex: { module: renderMod, entryPoint: "vs" }, fragment: { module: renderMod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
      const cGroups = [0, 1].map((k) =>
        device.createBindGroup({ layout: compute.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bufs[k] } }, { binding: 1, resource: { buffer: bufs[1 - k] } }, { binding: 2, resource: { buffer: params } }] }),
      );
      const rGroups = [0, 1].map((k) => device.createBindGroup({ layout: render.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bufs[k] } }, { binding: 1, resource: { buffer: params } }] }));
      let cur = 0;
      const tick = async (now: number) => {
        if (stop) return;
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        const m = mouse.current;
        device.queue.writeBuffer(params, 0, new Float32Array([count, dt, w, h, m?.x ?? 0, m?.y ?? 0, m ? 1 : 0, 0]));
        const t0 = performance.now();
        const enc = device.createCommandEncoder();
        const cp = enc.beginComputePass();
        cp.setPipeline(compute);
        cp.setBindGroup(0, cGroups[cur]);
        cp.dispatchWorkgroups(Math.ceil(count / 256));
        cp.end();
        cur = 1 - cur;
        const rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0.12, g: 0.29, b: 0.24, a: 1 }, loadOp: "clear", storeOp: "store" }] });
        rp.setPipeline(render);
        rp.setBindGroup(0, rGroups[cur]);
        rp.draw(9, count);
        rp.end();
        device.queue.submit([enc.finish()]);
        await device.queue.onSubmittedWorkDone();
        ms = ms * 0.9 + (performance.now() - t0) * 0.1;
        report(dt, count * (count - 1));
        if (!stop) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })().catch(() => setGpuOk(false));
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      device?.destroy?.();
    };
  }, [running, mode, count]);

  const pill = "rounded-full border border-line/30 px-3.5 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-glass";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${pill} ${running ? "bg-glass" : ""}`} onClick={() => setRunning((r) => !r)}>
          {running ? "Stop" : "Start the stress test"}
        </button>
        <span className="mx-1 h-5 w-px bg-line/20" aria-hidden />
        {(["gpu", "cpu"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} disabled={m === "gpu" && gpuOk === false} className={`${pill} ${mode === m ? "bg-glass" : ""} disabled:opacity-40`} onClick={() => setMode(m)}>
            {m === "gpu" ? "GPU (WebGPU compute)" : "CPU (spatial hash)"}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-2 font-sans text-xs">
          <span className="opacity-70">Koi</span>
          <input type="range" min={1000} max={20000} step={1000} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <span className="w-12 tabular-nums">{count.toLocaleString()}</span>
        </label>
      </div>
      {gpuOk === false && <p className="mt-2 font-sans text-xs opacity-70">WebGPU isn&rsquo;t available in this browser, so only the CPU version can run here.</p>}
      <div
        ref={wrap}
        className="relative mt-3 w-full overflow-hidden rounded-xl border-[1.5px] border-line bg-[#1f4a3d]"
        style={{ aspectRatio: "16 / 8.8" }}
        onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          mouse.current = { x: e.clientX - b.left, y: e.clientY - b.top };
        }}
        onPointerLeave={() => (mouse.current = null)}
      >
        <canvas ref={gpuCanvas} className={`absolute inset-0 h-full w-full ${mode === "gpu" && running ? "" : "hidden"}`} aria-hidden />
        <canvas ref={cpuCanvas} className={`absolute inset-0 h-full w-full ${mode === "cpu" && running ? "" : "hidden"}`} aria-hidden />
        {!running && <p className="absolute inset-0 grid place-items-center font-sans text-sm text-paper/80">{count.toLocaleString()} koi, waiting. Press start.</p>}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs">
        <div className="flex gap-1.5"><dt className="opacity-60">FPS</dt><dd className="tabular-nums">{running ? stats.fps : "–"}</dd></div>
        <div className="flex gap-1.5"><dt className="opacity-60">{mode === "gpu" ? "GPU frame" : "Flocking"}</dt><dd className="tabular-nums">{running ? `${stats.ms} ms` : "–"}</dd></div>
        <div className="flex gap-1.5"><dt className="opacity-60">Pairs compared / frame</dt><dd className="tabular-nums">{running ? stats.pairs.toLocaleString() : "–"}</dd></div>
      </dl>
    </div>
  );
}
