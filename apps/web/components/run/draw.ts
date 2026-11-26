import { CAT_X, VIEW_H, birdY, mulberry32, type Roof, type RunState, type World } from "@/lib/run/sim";

/**
 * Draws Mochi's rooftop run on a 2D canvas, in the building's fine rose line.
 *
 * Layers, back to front, each moving at its own fraction of the run's speed
 * (parallax): the sky (dusk deepening into night the further she goes), the
 * moon, line-drawn clouds, a far skyline, a nearer row of houses, and then the
 * rooftops she actually runs on, with their windows, awnings, water tanks and
 * string lights. Mochi herself is drawn from the same shapes as her sprite.
 */

const INK = "#9e3b4c";
const PAPER = "#fdf3ef";
const WALLS = ["#fdf3ef", "#fbeae6", "#fbf0e0", "#f4ecf6"];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: string, b: string, t: number) => {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), t))).join(",")})`;
};

export type Fx = { kind: "spark" | "dust" | "text"; x: number; y: number; vx: number; vy: number; life: number; text?: string };

// Mochi's shapes, from MochiSprite (a 200 × 130 box, paws at 90, 112). Path2D only exists in the browser, so they're made with the painter.
const SHAPES = { tail: "M48 90 C30 86 26 66 34 54", body: "M46 100 C42 82 56 72 80 72 L112 72 C128 72 136 84 134 100 Z", ears: "M126 56 L128 37 L140 49 Z M146 49 L158 39 L157 57 Z" };

export class Painter {
  private g: CanvasRenderingContext2D;
  private w = 640;
  private scale = 1;
  private grain: CanvasPattern | null = null;
  private far: { x: number; w: number; h: number; dome: boolean }[] = [];
  private near: { x: number; w: number; h: number; style: number }[] = [];
  private clouds: { x: number; y: number; s: number }[] = [];
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private cat = { tail: new Path2D(SHAPES.tail), body: new Path2D(SHAPES.body), ears: new Path2D(SHAPES.ears) };

  constructor(private canvas: HTMLCanvasElement) {
    this.g = canvas.getContext("2d")!;
    const rnd = mulberry32(42);
    for (let x = 0; x < 2400; ) {
      const w = 40 + rnd() * 90;
      this.far.push({ x, w, h: 60 + rnd() * 110, dome: rnd() < 0.25 });
      x += w + rnd() * 10;
    }
    for (let x = 0; x < 2400; ) {
      const w = 90 + rnd() * 120;
      this.near.push({ x, w, h: 90 + rnd() * 90, style: Math.floor(rnd() * 4) });
      x += w + 20 + rnd() * 40;
    }
    for (let i = 0; i < 7; i++) this.clouds.push({ x: rnd() * 2400, y: 30 + rnd() * 110, s: 0.6 + rnd() * 0.8 });
    for (let i = 0; i < 90; i++) this.stars.push({ x: rnd() * 1600, y: rnd() * 200, r: 0.4 + rnd() * 1.1, p: rnd() * 6.28 });
    // a faint paper grain, laid over everything
    const n = document.createElement("canvas");
    n.width = n.height = 128;
    const ng = n.getContext("2d")!;
    for (let i = 0; i < 900; i++) {
      ng.fillStyle = `rgba(110,40,50,${rnd() * 0.05})`;
      ng.fillRect(rnd() * 128, rnd() * 128, 1.2, 1.2);
    }
    this.grain = this.g.createPattern(n, "repeat");
  }

  /** Fits the canvas to its box; the world is always 360 units tall. */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.scale = (r.height * dpr) / VIEW_H;
    this.w = this.canvas.width / this.scale;
  }
  get width() {
    return this.w;
  }

  draw(world: World, s: RunState, fx: Fx[], t: number, bouncedAt: number) {
    const g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const night = Math.min(1, s.dist / 7000);
    this.sky(night, t, s.dist);
    this.skyline(night, s.dist);
    this.houses(night, s.dist);
    const left = s.dist - 40, right = s.dist + this.w + 40;
    for (const r of world.roofs) if (r.x + r.w > left && r.x < right) this.roof(r, s.dist, night, t, bouncedAt, s.frame);
    for (const it of world.items) {
      if (s.got.has(it.id) || it.x < left || it.x > right) continue;
      const x = it.x - s.dist, y = it.y + Math.sin(t / 380 + it.x) * 3;
      if (it.kind === "star") this.star(x, y, 8, t / 900 + it.x);
      else this.cake(x, y, t);
    }
    for (const b of world.birds) {
      const bx = b.x - s.frame * 1.2 - s.dist;
      if (bx > -30 && bx < this.w + 30) this.bird(bx, birdY(b, s.frame), t);
    }
    this.mochi(s, t);
    this.effects(fx);
    g.fillStyle = this.grain!;
    g.fillRect(0, 0, this.w, VIEW_H);
    // soft vignette
    const v = g.createRadialGradient(this.w / 2, VIEW_H * 0.55, VIEW_H * 0.4, this.w / 2, VIEW_H * 0.55, this.w * 0.75);
    v.addColorStop(0, "rgba(40,20,40,0)");
    v.addColorStop(1, `rgba(40,20,40,${0.18 + night * 0.12})`);
    g.fillStyle = v;
    g.fillRect(0, 0, this.w, VIEW_H);
  }

  private sky(n: number, t: number, dist: number) {
    const g = this.g;
    const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, mix("#6a5596", "#1f1a3e", n));
    sky.addColorStop(0.5, mix("#c68fb0", "#3f3570", n));
    sky.addColorStop(0.82, mix("#f3b9aa", "#7a5f94", n));
    sky.addColorStop(1, mix("#fbe0c9", "#b98aa6", n));
    g.fillStyle = sky;
    g.fillRect(0, 0, this.w, VIEW_H);
    // stars come out as night falls
    for (const st of this.stars) {
      const x = (((st.x - dist * 0.02) % 1600) + 1600) % 1600;
      if (x > this.w) continue;
      g.globalAlpha = Math.max(0, n * 1.2 - 0.15) * (0.55 + 0.45 * Math.sin(t / 700 + st.p));
      g.fillStyle = "#fff6e6";
      g.beginPath();
      g.arc(x, st.y, st.r, 0, 6.283);
      g.fill();
    }
    g.globalAlpha = 1;
    // the moon rises as she runs
    const mx = this.w * 0.78, my = lerp(150, 62, n);
    const halo = g.createRadialGradient(mx, my, 10, mx, my, 70);
    halo.addColorStop(0, `rgba(255,236,200,${0.35 + n * 0.25})`);
    halo.addColorStop(1, "rgba(255,236,200,0)");
    g.fillStyle = halo;
    g.fillRect(mx - 70, my - 70, 140, 140);
    g.fillStyle = mix("#fbe3c8", "#fbf1df", n);
    g.beginPath();
    g.arc(mx, my, 24, 0, 6.283);
    g.fill();
    g.strokeStyle = "rgba(158,59,76,.35)";
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = "rgba(200,160,150,.25)";
    for (const [dx, dy, r] of [[-8, -5, 4], [6, 6, 3], [3, -10, 2]]) {
      g.beginPath();
      g.arc(mx + dx, my + dy, r, 0, 6.283);
      g.fill();
    }
    // clouds, drawn as scalloped outlines
    for (const c of this.clouds) {
      const x = (((c.x - dist * 0.08 - t * 0.004) % 2400) + 2400) % 2400 - 200;
      if (x > this.w + 100) continue;
      g.save();
      g.translate(x, c.y);
      g.scale(c.s, c.s);
      g.beginPath();
      g.moveTo(0, 20);
      g.bezierCurveTo(-4, 6, 14, 0, 22, 8);
      g.bezierCurveTo(26, -8, 52, -10, 58, 4);
      g.bezierCurveTo(68, -2, 86, 4, 84, 20);
      g.closePath();
      g.fillStyle = `rgba(253,243,239,${0.22 - n * 0.1})`;
      g.fill();
      g.strokeStyle = `rgba(253,243,239,${0.55 - n * 0.2})`;
      g.lineWidth = 1 / c.s;
      g.stroke();
      g.restore();
    }
  }

  private skyline(n: number, dist: number) {
    const g = this.g;
    const off = (dist * 0.15) % 2400;
    g.fillStyle = mix("#d9a6b8", "#4c4180", n);
    g.strokeStyle = mix("rgba(158,59,76,.35)", "rgba(251,241,238,.25)", n);
    g.lineWidth = 0.8;
    for (const rep of [0, 2400]) {
      for (const b of this.far) {
        const x = b.x - off + rep;
        if (x + b.w < 0 || x > this.w) continue;
        const top = VIEW_H - 40 - b.h;
        g.beginPath();
        g.moveTo(x, VIEW_H);
        g.lineTo(x, top);
        if (b.dome) g.arc(x + b.w / 2, top, b.w / 2, Math.PI, 0);
        g.lineTo(x + b.w, top);
        g.lineTo(x + b.w, VIEW_H);
        g.fill();
        g.stroke();
        if (n > 0.35) {
          g.fillStyle = `rgba(255,214,150,${(n - 0.35) * 0.9})`;
          for (let wy = top + 10; wy < VIEW_H - 50; wy += 16) for (let wx = x + 6; wx < x + b.w - 6; wx += 12) if ((wx * 7 + wy * 3) % 5 < 1.2) g.fillRect(wx, wy, 3, 4);
          g.fillStyle = mix("#d9a6b8", "#4c4180", n);
        }
      }
    }
  }

  private houses(n: number, dist: number) {
    const g = this.g;
    const off = (dist * 0.4) % 2400;
    for (const rep of [0, 2400]) {
      for (const b of this.near) {
        const x = b.x - off + rep;
        if (x + b.w < 0 || x > this.w) continue;
        const top = VIEW_H - 30 - b.h;
        g.fillStyle = mix(WALLS[b.style], "#5b4e86", n * 0.75);
        g.globalAlpha = 0.85;
        g.fillRect(x, top, b.w, VIEW_H - top);
        g.globalAlpha = 1;
        g.strokeStyle = mix("rgba(158,59,76,.45)", "rgba(251,241,238,.35)", n);
        g.lineWidth = 0.9;
        g.strokeRect(x, top, b.w, VIEW_H - top);
        g.beginPath();
        g.moveTo(x - 3, top);
        g.lineTo(x + b.w + 3, top);
        g.stroke();
        for (let wy = top + 14; wy < VIEW_H - 40; wy += 26)
          for (let wx = x + 10; wx < x + b.w - 14; wx += 22) {
            const lit = n > 0.2 && (wx * 3 + wy) % 7 < 4;
            g.fillStyle = lit ? `rgba(255,214,150,${0.35 + n * 0.5})` : mix("#f2dfe4", "#3d3466", n);
            g.fillRect(wx, wy, 10, 13);
            g.strokeRect(wx, wy, 10, 13);
          }
      }
    }
  }

  private roof(r: Roof, dist: number, n: number, t: number, bouncedAt: number, frame: number) {
    const g = this.g;
    const x = r.x - dist, top = VIEW_H - r.h, w = r.w;
    g.lineCap = "round";
    g.lineJoin = "round";
    // the wall, its windows (lamplit after dusk), and a cornice along the top
    g.fillStyle = WALLS[r.style];
    g.fillRect(x, top, w, r.h + 2);
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.strokeRect(x, top, w, r.h + 2);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - 5, top);
    g.lineTo(x + w + 5, top);
    g.moveTo(x - 5, top + 6);
    g.lineTo(x + w + 5, top + 6);
    g.stroke();
    g.beginPath();
    for (let dx = 4; dx < w - 4; dx += 9) g.rect(x + dx, top + 6, 4, 3);
    g.globalAlpha = 0.6;
    g.stroke();
    g.globalAlpha = 1;
    for (let wy = top + 28; wy < VIEW_H - 24; wy += 46) {
      for (let wx = x + 20; wx < x + w - 34; wx += 44) {
        const lit = n > 0.15 && ((wx - x) * 13 + wy + r.x) % 5 < 3.4;
        if (lit) {
          const lg = g.createLinearGradient(0, wy, 0, wy + 26);
          lg.addColorStop(0, "#fff1cc");
          lg.addColorStop(1, "#efb173");
          g.globalAlpha = Math.min(1, n * 2);
          g.fillStyle = lg;
          g.fillRect(wx, wy, 20, 26);
          g.globalAlpha = 1;
        } else {
          g.fillStyle = mix("#f1dde3", "#3f3668", n);
          g.fillRect(wx, wy, 20, 26);
        }
        g.strokeStyle = INK;
        g.strokeRect(wx, wy, 20, 26);
        g.beginPath();
        g.moveTo(wx + 10, wy);
        g.lineTo(wx + 10, wy + 26);
        g.moveTo(wx - 3, wy + 28);
        g.lineTo(wx + 23, wy + 28);
        g.stroke();
      }
    }
    // what stands on the roof
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    const d = r.deco;
    if (d === "tank") {
      const tx = x + w * 0.62;
      g.beginPath();
      g.moveTo(tx + 3, top);
      g.lineTo(tx + 5, top - 12);
      g.moveTo(tx + 29, top);
      g.lineTo(tx + 27, top - 12);
      g.stroke();
      g.fillStyle = "#e9eef2";
      g.beginPath();
      g.rect(tx, top - 40, 32, 28);
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(tx + 16, top - 40, 16, 4, 0, 0, 6.283);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(tx, top - 26);
      g.lineTo(tx + 32, top - 26);
      g.globalAlpha = 0.5;
      g.stroke();
      g.globalAlpha = 1;
    } else if (d === "antenna") {
      const ax = x + w * 0.3;
      g.beginPath();
      g.moveTo(ax, top);
      g.lineTo(ax, top - 46);
      for (const [y, l] of [[-40, 14], [-32, 11], [-24, 8]]) {
        g.moveTo(ax - l, top + y);
        g.lineTo(ax + l, top + y);
      }
      g.stroke();
    } else if (d === "plants") {
      for (const [k, px] of [[0, 0.2], [1, 0.32], [2, 0.75]] as const) {
        const cx = x + w * px;
        g.fillStyle = "#f0c3a8";
        g.beginPath();
        g.moveTo(cx - 8, top);
        g.lineTo(cx - 10, top - 14);
        g.lineTo(cx + 10, top - 14);
        g.lineTo(cx + 8, top);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = "rgba(141,191,106,.55)";
        const sway = Math.sin(t / 700 + cx) * 2;
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.ellipse(cx + i * 4 + sway, top - 20 - Math.abs(i) * -2 - (k === 1 ? 6 : 0), 3, 8, i * 0.4, 0, 6.283);
          g.fill();
          g.stroke();
        }
      }
    } else if (d === "lights") {
      const x0 = x + 10, x1 = x + w - 10;
      g.beginPath();
      g.moveTo(x0, top - 30);
      g.lineTo(x0, top);
      g.moveTo(x1, top - 30);
      g.lineTo(x1, top);
      g.moveTo(x0, top - 30);
      g.quadraticCurveTo((x0 + x1) / 2, top - 6, x1, top - 30);
      g.stroke();
      for (let i = 1; i < 12; i++) {
        const u = i / 12, bx = lerp(x0, x1, u), by = top - 30 + 2 * u * (1 - u) * 24;
        const on = 0.55 + 0.45 * Math.sin(t / 260 + i * 1.7);
        g.fillStyle = i % 3 === 0 ? `rgba(229,143,168,${on})` : `rgba(246,207,110,${on})`;
        g.beginPath();
        g.arc(bx, by + 4, 3.2, 0, 6.283);
        g.fill();
        if (n > 0.2) {
          g.fillStyle = `rgba(255,226,160,${0.25 * on * n})`;
          g.beginPath();
          g.arc(bx, by + 4, 9, 0, 6.283);
          g.fill();
        }
      }
    } else if (d === "chimney") {
      const cx = x + w * 0.45;
      g.fillStyle = PAPER;
      g.fillRect(cx, top - 26, 18, 26);
      g.strokeRect(cx, top - 26, 18, 26);
      g.strokeRect(cx - 3, top - 30, 24, 5);
      g.globalAlpha = 0.45;
      g.beginPath();
      const k = (t / 40) % 30;
      g.moveTo(cx + 9, top - 32);
      g.bezierCurveTo(cx + 2, top - 44 - k * 0.2, cx + 18, top - 52, cx + 8, top - 64 - k * 0.3);
      g.stroke();
      g.globalAlpha = 1;
    }
    // the awning: a striped springboard at the roof's far end, that dips when she bounces
    if (r.awning) {
      const ax = r.awning.x - dist, aw = r.awning.w;
      const since = (frame - bouncedAt) / 60;
      const dip = bouncedAt >= 0 && since < 0.6 ? Math.sin(since * 20) * 7 * (1 - since / 0.6) : 0;
      g.beginPath();
      g.moveTo(ax, top);
      g.lineTo(ax + 4, top - 20);
      g.moveTo(ax + aw, top);
      g.lineTo(ax + aw - 4, top - 20);
      g.stroke();
      const y0 = top - 20 + dip;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? PAPER : "#efb4c1";
        g.beginPath();
        g.moveTo(ax + (i * aw) / 6, y0);
        g.lineTo(ax + ((i + 1) * aw) / 6, y0);
        g.lineTo(ax + ((i + 1) * aw) / 6, y0 + 9);
        g.lineTo(ax + (i * aw) / 6, y0 + 9);
        g.fill();
      }
      g.beginPath();
      g.rect(ax, y0, aw, 9);
      g.stroke();
      g.beginPath();
      for (let i = 0; i < 6; i++) g.arc(ax + ((i + 0.5) * aw) / 6, y0 + 9, aw / 12, 0, Math.PI);
      g.fillStyle = "#efb4c1";
      g.fill();
      g.stroke();
    }
  }

  private star(x: number, y: number, r: number, spin: number) {
    const g = this.g;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    halo.addColorStop(0, "rgba(255,226,150,.55)");
    halo.addColorStop(1, "rgba(255,226,150,0)");
    g.fillStyle = halo;
    g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(spin) * 0.25);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = "#f6cf6a";
    g.fill();
    g.strokeStyle = "#a9781f";
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  private cake(x: number, y: number, t: number) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.strokeStyle = INK;
    g.lineWidth = 1.1;
    g.fillStyle = PAPER;
    g.beginPath();
    g.moveTo(-12, 8);
    g.lineTo(12, 8);
    g.lineTo(12, -2);
    g.lineTo(-12, -6);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#f4b6c4";
    g.beginPath();
    g.moveTo(-12, -6);
    g.lineTo(12, -2);
    g.lineTo(12, 1);
    g.quadraticCurveTo(4, 4, 0, 0);
    g.quadraticCurveTo(-6, -3, -12, -3);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(1, -4);
    g.lineTo(1, -14);
    g.stroke();
    const f = 1 + Math.sin(t / 90) * 0.15;
    g.fillStyle = "#f6b13c";
    g.beginPath();
    g.ellipse(1, -18, 2.2 * f, 3.6 * f, 0, 0, 6.283);
    g.fill();
    g.restore();
  }

  private bird(x: number, y: number, t: number) {
    const g = this.g;
    const flap = Math.sin(t / 70) * 7;
    g.strokeStyle = INK;
    g.lineWidth = 1.3;
    g.fillStyle = "#e7e1ee";
    g.beginPath();
    g.ellipse(x, y, 10, 6, -0.1, 0, 6.283);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(x - 9, y - 4, 4.5, 0, 6.283);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(x - 10, y - 5, 0.9, 0, 6.283);
    g.fill();
    g.beginPath();
    g.moveTo(x - 13, y - 4);
    g.lineTo(x - 17, y - 3);
    g.moveTo(x - 2, y - 2);
    g.quadraticCurveTo(x + 4, y - 12 - flap, x + 10, y - 4 - flap);
    g.moveTo(x + 9, y);
    g.lineTo(x + 16, y + 2);
    g.stroke();
  }

  private mochi(s: RunState, t: number) {
    const g = this.g, c = s.cat;
    const k = 0.4;
    const air = !c.onGround;
    const phase = s.dist / 9;
    const swing = air ? 0 : Math.sin(phase) * 26;
    const tilt = air ? Math.max(-16, Math.min(16, c.vy * 1.6)) : 0;
    const sq = c.squash;
    g.save();
    // her shadow on the roof below
    g.fillStyle = "rgba(90,30,50,.12)";
    g.beginPath();
    g.ellipse(CAT_X, c.y + (air ? 0 : 1), 14, 2.5, 0, 0, 6.283);
    if (!air) g.fill();
    g.translate(CAT_X, c.y);
    g.scale(k * (1 + sq * 0.12), k * (1 - sq * 0.14));
    g.translate(-90, -112);
    g.rotate((tilt * Math.PI) / 180);
    g.lineWidth = 1.6 / k;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = INK;
    g.fillStyle = PAPER;
    const leg = (x: number, y: number, deg: number) => {
      g.save();
      g.translate(x, y);
      g.rotate((deg * Math.PI) / 180);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, 14);
      g.stroke();
      g.restore();
    };
    g.save();
    g.translate(48, 90);
    g.rotate(Math.sin(t / 220) * 0.12 + (air ? -0.3 : 0));
    g.translate(-48, -90);
    g.stroke(this.cat.tail);
    g.restore();
    leg(66, 98, air ? 40 : -swing);
    leg(126, 98, air ? -40 : swing);
    g.fill(this.cat.body);
    g.stroke(this.cat.body);
    leg(58, 98, air ? 34 : swing);
    leg(118, 98, air ? -34 : -swing);
    g.fill(this.cat.ears);
    g.stroke(this.cat.ears);
    g.beginPath();
    g.arc(141, 66, 18, 0, 6.283);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(149, 63, 1.9, 0, 6.283);
    g.fill();
    g.beginPath();
    g.moveTo(156, 70);
    g.lineTo(158, 71.5);
    g.lineTo(156, 73);
    g.stroke();
    g.fillStyle = "rgba(244,182,196,.8)";
    g.beginPath();
    g.arc(146, 72, 3, 0, 6.283);
    g.fill();
    g.restore();
  }

  private effects(fx: Fx[]) {
    const g = this.g;
    for (const f of fx) {
      g.globalAlpha = Math.max(0, f.life);
      if (f.kind === "spark") {
        g.fillStyle = "#f6cf6a";
        g.beginPath();
        g.arc(f.x, f.y, 1.8, 0, 6.283);
        g.fill();
      } else if (f.kind === "dust") {
        g.strokeStyle = INK;
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(f.x, f.y, 3 + (1 - f.life) * 5, 0, 6.283);
        g.stroke();
      } else if (f.text) {
        g.fillStyle = "#fff6e6";
        g.font = "italic 13px Georgia, serif";
        g.textAlign = "center";
        g.fillText(f.text, f.x, f.y);
      }
    }
    g.globalAlpha = 1;
  }
}
