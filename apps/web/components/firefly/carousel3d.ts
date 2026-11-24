import * as THREE from "three";

/**
 * Door 7 · the carousel, drawn in three.js as fine ink lines with a few pale
 * washes, like the rest of the site.
 *
 * Everything is line segments built here from a handful of curves (no models
 * to load): a striped base, a twisted brass pole per song, a scalloped canopy
 * with bows and fringe, a striped roof and a pennant. Each pole carries a
 * small glass lantern with a firefly inside; the firefly is the song.
 *
 * The page talks to it through a small controller: how many poles, whether
 * it's playing, and nudges left and right. It reports which pole is at the
 * front. Turning is a little physics: drag sets a velocity, friction slows it,
 * and when it's slow enough a spring settles the nearest pole at the front.
 */

const INK = 0x9e3b4c;
const BRASS = 0xb98a2e;
const BLUSH = 0xe58fa8;
const BUTTER = 0xfbe3b0;
const CREAM = 0xfdf6ee;

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const at = (r: number, a: number, y: number) => v(Math.cos(a) * r, y, Math.sin(a) * r);
const ring = (r: number, y: number, n = 72) => Array.from({ length: n }, (_, i) => at(r, (i / n) * Math.PI * 2, y));

/** Collects line segments and translucent faces, then turns them into meshes. */
class Sketch {
  lines: Record<number, number[]> = {};
  faces: Record<number, number[]> = {};
  seg(col: number, a: V, b: V) {
    (this.lines[col] ??= []).push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  poly(col: number, p: V[], closed = true) {
    for (let i = 0; i < p.length - (closed ? 0 : 1); i++) this.seg(col, p[i], p[(i + 1) % p.length]);
  }
  tri(col: number, a: V, b: V, c: V) {
    (this.faces[col] ??= []).push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  quad(col: number, a: V, b: V, c: V, d: V) {
    this.tri(col, a, b, c);
    this.tri(col, a, c, d);
  }
  build(into: THREE.Object3D, lineOpacity = 0.85) {
    for (const [col, pts] of Object.entries(this.lines)) {
      const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      into.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: +col, transparent: true, opacity: +col === BRASS ? 0.9 : lineOpacity })));
    }
    for (const [col, pts] of Object.entries(this.faces)) {
      const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const opacity = +col === CREAM ? 0.4 : 0.2;
      into.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: +col, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })));
    }
  }
}

const BASE_R = 3.2;
const POLE_R = 2.35;
const VALANCE_Y = 3.55;
const CANOPY_R = 3.35;
const LANTERN_Y = 1.75;

/** The parts that don't depend on how many songs there are. */
function frame(s: Sketch) {
  // base: a drum with alternating stripes and a little rivet line
  s.poly(INK, ring(BASE_R, 0));
  s.poly(INK, ring(BASE_R, 0.55));
  s.poly(INK, ring(BASE_R, 0.62));
  s.poly(INK, ring(BASE_R - 0.15, 0.62));
  const NS = 24;
  for (let i = 0; i < NS; i++) {
    const a0 = (i / NS) * Math.PI * 2;
    const a1 = ((i + 1) / NS) * Math.PI * 2;
    s.seg(INK, at(BASE_R, a0, 0), at(BASE_R, a0, 0.55));
    s.quad(i % 2 ? BLUSH : BUTTER, at(BASE_R, a0, 0.04), at(BASE_R, a1, 0.04), at(BASE_R, a1, 0.53), at(BASE_R, a0, 0.53));
    s.tri(BUTTER, v(0, 0.62, 0), at(BASE_R - 0.15, a0, 0.62), at(BASE_R - 0.15, a1, 0.62));
    for (let k = 1; k < 4; k++) {
      const a = a0 + ((a1 - a0) * k) / 4;
      s.seg(INK, at(BASE_R, a, 0.12), at(BASE_R, a, 0.16));
    }
  }
  // the central drum, with a carved ribbon running up each panel
  const NC = 12;
  for (let i = 0; i < NC; i++) {
    const a0 = (i / NC) * Math.PI * 2;
    const a1 = ((i + 1) / NC) * Math.PI * 2;
    s.seg(INK, at(0.75, a0, 0.62), at(0.75, a0, 3.4));
    s.quad(i % 2 ? BLUSH : CREAM, at(0.75, a0, 0.62), at(0.75, a1, 0.62), at(0.75, a1, 3.4), at(0.75, a0, 3.4));
    const m = (a0 + a1) / 2;
    for (let k = 0; k < 14; k++) {
      const t = k / 13;
      const y = 1.2 + t * 1.6;
      s.seg(INK, at(0.76, m + 0.08 * Math.sin(t * Math.PI * 2), y), at(0.76, m + 0.03 * Math.cos(t * 9), y + 0.12));
    }
  }
  s.poly(INK, ring(0.75, 3.4, NC));
  s.poly(INK, ring(0.85, 0.62, NC));
  s.poly(INK, ring(0.85, 0.8, NC));
  // canopy: a scalloped valance with fringe and a bow at every seam
  s.poly(INK, ring(CANOPY_R, VALANCE_Y + 0.55));
  s.poly(INK, ring(CANOPY_R, VALANCE_Y + 0.47));
  const NV = 16;
  for (let i = 0; i < NV; i++) {
    const a0 = (i / NV) * Math.PI * 2;
    const a1 = ((i + 1) / NV) * Math.PI * 2;
    let prev: V | null = null;
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const a = a0 + (a1 - a0) * t;
      const p = at(CANOPY_R, a, VALANCE_Y - 0.18 * Math.sin(t * Math.PI));
      if (prev) {
        s.seg(INK, prev, p);
        s.quad(i % 2 ? BLUSH : CREAM, prev, p, at(CANOPY_R, a, VALANCE_Y + 0.47), at(CANOPY_R, a0 + ((a1 - a0) * (k - 1)) / 10, VALANCE_Y + 0.47));
      }
      prev = p;
    }
    s.seg(INK, at(CANOPY_R, a0, VALANCE_Y), at(CANOPY_R, a0, VALANCE_Y + 0.55));
    for (let k = 0; k < 12; k++) {
      const t = (k + 0.5) / 12;
      const y = VALANCE_Y - 0.18 * Math.sin(t * Math.PI);
      const a = a0 + (a1 - a0) * t;
      s.seg(BRASS, at(CANOPY_R, a, y), at(CANOPY_R, a, y - 0.1));
    }
    bow(s, at(CANOPY_R + 0.02, a0, VALANCE_Y + 0.22), a0 + Math.PI / 2, 0.16);
  }
  // roof: striped panels curving up to a brass finial and a pennant
  const roof = (t: number): [number, number] => [CANOPY_R * (1 - t) * (1 - 0.18 * Math.sin(t * Math.PI)), VALANCE_Y + 0.55 + 1.7 * t];
  for (let i = 0; i < NV; i++) {
    const a0 = (i / NV) * Math.PI * 2;
    const a1 = ((i + 1) / NV) * Math.PI * 2;
    let p0: V | null = null;
    let p1: V | null = null;
    for (let k = 0; k <= 10; k++) {
      const [r, y] = roof(k / 10);
      const q0 = at(r, a0, y);
      const q1 = at(r, a1, y);
      if (p0 && p1) {
        s.seg(INK, p0, q0);
        s.quad(i % 2 ? BLUSH : CREAM, p0, p1, q1, q0);
      }
      p0 = q0;
      p1 = q1;
    }
  }
  for (let k = 1; k < 4; k++) {
    const [r, y] = roof(k / 4);
    s.poly(INK, ring(r, y, 48));
  }
  const top = VALANCE_Y + 2.25;
  s.seg(BRASS, v(0, top, 0), v(0, top + 0.65, 0));
  s.poly(BRASS, ring(0.12, top + 0.15, 12));
  s.poly(BRASS, ring(0.07, top + 0.35, 10));
  const flag = [v(0, top + 0.65, 0), v(0.55, top + 0.53, 0), v(0.42, top + 0.41, 0), v(0, top + 0.37, 0)];
  s.poly(INK, flag);
  s.quad(BLUSH, flag[0], flag[1], flag[2], flag[3]);
}

/** A ribbon bow: a figure-eight loop and two tails, facing outwards along `side`. */
function bow(s: Sketch, c: V, side: number, w: number, col = INK) {
  const dx = Math.cos(side);
  const dz = Math.sin(side);
  const loop: V[] = [];
  for (let k = 0; k <= 14; k++) {
    const t = (k / 14) * Math.PI * 2;
    loop.push(v(c.x + dx * Math.sin(t) * w, c.y + Math.sin(2 * t) * w * 0.42, c.z + dz * Math.sin(t) * w));
  }
  s.poly(col, loop);
  s.seg(col, c, v(c.x + dx * w * 0.45, c.y - w * 1.4, c.z + dz * w * 0.45));
  s.seg(col, c, v(c.x - dx * w * 0.45, c.y - w * 1.4, c.z - dz * w * 0.45));
}

/** One pole: two brass rails with a barley-twist wound round them. */
function pole(s: Sketch, a: number) {
  const c = at(POLE_R, a, 0);
  for (const o of [-0.035, 0.035]) {
    const q = at(POLE_R, a + o / POLE_R, 0);
    s.seg(BRASS, v(q.x, 0.62, q.z), v(q.x, VALANCE_Y - 0.15, q.z));
  }
  let prev: V | null = null;
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    const h = t * 24 * Math.PI * 2;
    const p = v(c.x + Math.cos(h) * 0.04, 0.62 + t * (VALANCE_Y - 0.77), c.z + Math.sin(h) * 0.04);
    if (prev) s.seg(BRASS, prev, p);
    prev = p;
  }
  for (const y of [0.62, VALANCE_Y - 0.15]) s.poly(BRASS, Array.from({ length: 10 }, (_, q) => v(c.x + Math.cos((q / 10) * Math.PI * 2) * 0.09, y, c.z + Math.sin((q / 10) * Math.PI * 2) * 0.09)));
}

/** A lantern in its own space (it bobs and turns separately): glass box, cap, ring, bow. */
function lantern(): THREE.Group {
  const s = new Sketch();
  const w = 0.17;
  const h = 0.34;
  const sq = (y: number) => [v(-w, y, -w), v(w, y, -w), v(w, y, w), v(-w, y, w)];
  s.poly(INK, sq(0));
  s.poly(INK, sq(h));
  sq(0).forEach((q, i) => s.seg(INK, q, sq(h)[i]));
  sq(h).forEach((q) => s.seg(INK, q, v(0, h + 0.16, 0)));
  s.seg(INK, v(0, h + 0.16, 0), v(0, h + 0.3, 0));
  s.poly(INK, ring(0.05, h + 0.34, 10));
  sq(0).forEach((q) => s.seg(INK, q, v(q.x * 0.6, -0.07, q.z * 0.6)));
  bow(s, v(0, -0.12, w + 0.01), 0, 0.16);
  const g = new THREE.Group();
  s.build(g);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w * 2, h, w * 2), new THREE.MeshBasicMaterial({ color: BUTTER, transparent: true, opacity: 0.2, depthWrite: false }));
  glass.position.y = h / 2;
  glass.name = "glass";
  g.add(glass);
  const knot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: BLUSH, transparent: true, opacity: 0.5, depthWrite: false }));
  knot.position.set(0, -0.12, w + 0.02);
  g.add(knot);
  return g;
}

/** A soft gold dot, drawn once into a texture for the firefly sprites. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(190,120,26,1)");
  g.addColorStop(0.14, "rgba(235,172,60,.95)");
  g.addColorStop(0.4, "rgba(242,196,90,.3)");
  g.addColorStop(1, "rgba(242,196,90,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export type CarouselControl = {
  /** Number of songs (poles) on the carousel. */
  setCount(n: number): void;
  /** Spins slowly and bobs the lanterns while true; `index` is the song playing. */
  setPlaying(index: number | null): void;
  /** Turn one pole left (-1) or right (+1). */
  nudge(dir: number): void;
  dispose(): void;
};

const AMBIENT = 26;

export function createCarousel(host: HTMLElement, onFront: (i: number) => void, reduceMotion: boolean): CarouselControl {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const car = new THREE.Group();
  scene.add(car);
  const still = new Sketch();
  frame(still);
  still.build(car);

  let poles = new THREE.Group();
  car.add(poles);
  let lanterns: THREE.Group[] = [];
  let count = 0;
  const step = () => (Math.PI * 2) / Math.max(count, 1);

  // fireflies: one per lantern (up to 24) plus a few drifting round the outside
  const MAXL = 24;
  const N = MAXL + AMBIENT;
  const pos = new Float32Array(N * 3);
  const bright = new Float32Array(N);
  const size = new Float32Array(N);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pg.setAttribute("br", new THREE.BufferAttribute(bright, 1));
  pg.setAttribute("sz", new THREE.BufferAttribute(size, 1));
  const tex = glowTexture();
  const pm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { tex: { value: tex }, h: { value: 400 } },
    vertexShader: `attribute float br; attribute float sz; varying float vb; uniform float h;
      void main() { vb = br; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = sz * h * 0.5 / -mv.z; }`,
    fragmentShader: `uniform sampler2D tex; varying float vb;
      void main() { vec4 c = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vb); }`,
  });
  const flies = new THREE.Points(pg, pm);
  flies.renderOrder = 1; // after the see-through panels, which would otherwise paint over them
  flies.frustumCulled = false; // the points move every frame; their bounds are never stale this way
  scene.add(flies);
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const drift = Array.from({ length: AMBIENT }, () => ({ a: rnd() * Math.PI * 2, r: 3.8 + rnd() * 2.2, y: 0.6 + rnd() * 4.6, s: rnd() * 99, sp: (rnd() - 0.5) * 0.25 }));

  // turning: theta is how far the carousel has turned; pole i sits at angle i·step + theta, and the front is +z (π/2)
  let theta = 0;
  let vel = 0;
  let playing: number | null = null;
  let drag: { x: number; t: number } | null = null;
  let lastFront = -1;
  const frontIndex = () => (count ? (((Math.round((Math.PI / 2 - theta) / step()) % count) + count) % count) : 0);

  function setCount(n: number) {
    count = Math.min(n, MAXL);
    car.remove(poles);
    poles.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    poles = new THREE.Group();
    const s = new Sketch();
    for (let i = 0; i < count; i++) pole(s, i * step());
    s.build(poles);
    lanterns = Array.from({ length: count }, () => lantern());
    lanterns.forEach((l) => poles.add(l));
    car.add(poles);
    vel = reduceMotion ? 0 : 0.16; // a little spin as the new songs arrive
    lastFront = -1;
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    cam.aspect = w / h;
    // keep the whole carousel in view on narrow screens by stepping back
    const dist = w / h < 1 ? 12.6 / Math.max(0.62, w / h) : 12.6;
    cam.position.set(0, 3.6 + (dist - 12.6) * 0.15, dist);
    cam.lookAt(0, 2.25, 0);
    cam.updateProjectionMatrix();
    pm.uniforms.h.value = h * renderer.getPixelRatio();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) last = performance.now();
  });
  io.observe(host);

  let raf = 0;
  let last = performance.now();
  const tmp = new THREE.Vector3();
  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const T = now / 1000;
    if (playing != null) {
      theta += dt * (reduceMotion ? 0 : 0.35);
    } else if (!drag) {
      theta += vel;
      vel *= Math.pow(0.92, dt * 60);
      if (Math.abs(vel) < 0.002) {
        vel = 0;
        const target = Math.PI / 2 - frontIndex() * step();
        let d = target - theta;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        theta += reduceMotion ? d : d * Math.min(1, dt * 6);
      }
    }
    car.rotation.y = -theta;
    car.updateMatrixWorld();
    const front = frontIndex();
    if (front !== lastFront && playing == null) {
      lastFront = front;
      onFront(front);
    }
    lanterns.forEach((l, i) => {
      const a = i * step();
      const bob = reduceMotion ? 0 : playing != null ? Math.sin(T * 2.2 + i * 1.3) * 0.22 : Math.sin(T * 0.8 + i) * 0.04;
      const c = at(POLE_R, a, 0);
      l.position.set(c.x, LANTERN_Y + bob, c.z);
      l.rotation.y = -a + Math.PI / 2;
      tmp.set(c.x, LANTERN_Y + bob + 0.17, c.z).applyMatrix4(car.matrixWorld);
      pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      const lit = playing != null ? i === playing : i === front;
      const flicker = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(T * 3 + i * 2);
      bright[i] = (lit ? 1 : 0.55) * flicker;
      size[i] = lit ? 1.7 : 1.15;
      ((l.getObjectByName("glass") as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit ? 0.45 : 0.2;
    });
    for (let i = count; i < MAXL; i++) bright[i] = 0;
    drift.forEach((f, k) => {
      const i = MAXL + k;
      const a = f.a + (reduceMotion ? 0 : T * f.sp);
      pos.set([Math.cos(a) * f.r, f.y + (reduceMotion ? 0 : Math.sin(T * 0.6 + f.s) * 0.3), Math.sin(a) * f.r], i * 3);
      bright[i] = reduceMotion ? 0.4 : Math.pow(Math.max(0, Math.sin(T * 1.4 + f.s)), 3) * 0.9;
      size[i] = 0.8;
    });
    pg.attributes.position.needsUpdate = true;
    pg.attributes.br.needsUpdate = true;
    pg.attributes.sz.needsUpdate = true;
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(tick);

  // dragging turns it (horizontal only, so the page still scrolls on phones)
  const el = renderer.domElement;
  el.style.touchAction = "pan-y";
  const down = (e: PointerEvent) => {
    if (playing != null) return;
    drag = { x: e.clientX, t: performance.now() };
    el.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const d = ((e.clientX - drag.x) / host.clientWidth) * 4;
    theta += d;
    vel = d * 0.25;
    drag.x = e.clientX;
  };
  const up = () => {
    drag = null;
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  return {
    setCount,
    setPlaying(i) {
      playing = i;
      if (i == null) lastFront = -1;
    },
    nudge(dir) {
      if (playing != null) return;
      if (reduceMotion) theta -= dir * step();
      else vel = -dir * step() * 0.08;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      tex.dispose();
      renderer.dispose();
      el.remove();
    },
  };
}
