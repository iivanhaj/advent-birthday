import { INK, PAPER } from "@/lib/booth/film";
import { STRIP, photoSlots, type FrameId, type Rect, type Stamp, type StampId } from "@/lib/booth/strip";

/**
 * Paints the strip at print size (600 × 1800 = 2 × 6 in at 300 dpi), in the
 * same fine rose line as the rest of the site, with only faint colour.
 */

const ink = `rgb(${INK.join(",")})`;
const paper = `rgb(${PAPER.join(",")})`;
export const WASH = { blush: "rgba(229,143,168,.22)", gold: "rgba(242,196,90,.6)", goldSoft: "rgba(242,196,90,.25)", butter: "rgba(251,227,176,.45)", sage: "rgba(141,191,106,.3)" };

/** The site's fonts are self-hosted by next/font under generated names; read them off the page. */
export function siteFonts() {
  const css = getComputedStyle(document.body);
  return {
    serif: css.getPropertyValue("--font-playfair").trim() || "Georgia, serif",
    sans: css.getPropertyValue("--font-inter").trim() || "system-ui, sans-serif",
  };
}

/** A seeded PRNG, so the paper grain of a strip doesn't change when it's repainted. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function framePath(c: CanvasRenderingContext2D, s: Rect, frame: FrameId) {
  c.beginPath();
  if (frame === "window") {
    const r = s.w / 2;
    c.moveTo(s.x, s.y + s.h);
    c.lineTo(s.x, s.y + r);
    c.arc(s.x + r, s.y + r, r, Math.PI, 0);
    c.lineTo(s.x + s.w, s.y + s.h);
    c.closePath();
  } else c.rect(s.x, s.y, s.w, s.h);
}

function leaf(c: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
  c.fillStyle = WASH.sage;
  c.fill();
  c.stroke();
  c.restore();
}

function vine(c: CanvasRenderingContext2D, s: Rect) {
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(s.x - 14, s.y + s.h + 10);
  c.bezierCurveTo(s.x - 30, s.y + s.h * 0.6, s.x - 4, s.y + s.h * 0.3, s.x - 16, s.y - 10);
  c.stroke();
  c.beginPath();
  c.moveTo(s.x + s.w + 14, s.y - 10);
  c.bezierCurveTo(s.x + s.w + 30, s.y + s.h * 0.4, s.x + s.w + 4, s.y + s.h * 0.7, s.x + s.w + 16, s.y + s.h + 10);
  c.stroke();
  for (let j = 0; j < 5; j++) {
    leaf(c, s.x - 18 + (j % 2 ? 6 : -6), s.y + s.h - (j * s.h) / 4.5, j % 2 ? 0.8 : -0.8);
    leaf(c, s.x + s.w + 18 + (j % 2 ? -6 : 6), s.y + (j * s.h) / 4.5, j % 2 ? -0.8 : 0.8);
  }
}

/** The strip without stamps. Shots are 4:3 canvases already developed with a film. */
export function paintStrip(shots: CanvasImageSource[], frame: FrameId, caption: string, seed: number): HTMLCanvasElement {
  const S = document.createElement("canvas");
  S.width = STRIP.w;
  S.height = STRIP.h;
  const c = S.getContext("2d")!;
  const fonts = siteFonts();
  c.fillStyle = paper;
  c.fillRect(0, 0, S.width, S.height);
  const rnd = mulberry32(seed);
  for (let i = 0; i < 1400; i++) {
    c.fillStyle = `rgba(158,59,76,${rnd() * 0.035})`;
    c.fillRect(rnd() * S.width, rnd() * S.height, 1.4, 1.4);
  }
  c.strokeStyle = ink;
  c.lineCap = "round";
  c.lineWidth = 1.5;
  c.strokeRect(18, 18, S.width - 36, S.height - 36);
  c.globalAlpha = 0.4;
  c.lineWidth = 1;
  c.strokeRect(26, 26, S.width - 52, S.height - 52);
  c.globalAlpha = 1;

  photoSlots().forEach((s, i) => {
    const shot = shots[i];
    if (shot) {
      c.save();
      framePath(c, s, frame);
      c.clip();
      c.drawImage(shot, s.x, s.y, s.w, s.h);
      c.restore();
    }
    c.lineWidth = 1.6;
    framePath(c, s, frame);
    c.stroke();
    if (frame === "window") {
      c.beginPath();
      c.moveTo(s.x - 16, s.y + s.h + 6);
      c.lineTo(s.x + s.w + 16, s.y + s.h + 6);
      c.stroke();
    }
    if (frame === "garden") vine(c, s);
  });

  c.fillStyle = ink;
  c.textAlign = "center";
  c.font = `italic 38px ${fonts.serif}`;
  c.fillText("birthday, in four poses", S.width / 2, 1688);
  c.globalAlpha = 0.4;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(220, 1712);
  c.lineTo(380, 1712);
  c.stroke();
  c.globalAlpha = 1;
  c.font = `500 12px ${fonts.sans}`;
  c.letterSpacing = "1px";
  c.fillText(caption, S.width / 2, 1742);
  return S;
}

/** Line-art stamps: ink outlines with the faintest wash inside. */
export function drawStamp(c: CanvasRenderingContext2D, kind: StampId, x: number, y: number, dateText: string, serif: string) {
  c.save();
  c.strokeStyle = ink;
  c.lineJoin = "round";
  c.lineCap = "round";
  switch (kind) {
    case "heart":
      c.beginPath();
      c.moveTo(x, y + 26);
      c.bezierCurveTo(x - 46, y - 4, x - 24, y - 38, x, y - 14);
      c.bezierCurveTo(x + 24, y - 38, x + 46, y - 4, x, y + 26);
      c.fillStyle = WASH.blush;
      c.fill();
      c.lineWidth = 2.4;
      c.stroke();
      break;
    case "flower":
      c.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        c.save();
        c.translate(x, y);
        c.rotate((i / 6) * Math.PI * 2);
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(-13, -14, -9, -34, 0, -38);
        c.bezierCurveTo(9, -34, 13, -14, 0, 0);
        c.stroke();
        c.restore();
      }
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fillStyle = WASH.gold;
      c.fill();
      c.stroke();
      break;
    case "star":
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 14 : 34;
        c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = WASH.goldSoft;
      c.fill();
      c.lineWidth = 2;
      c.stroke();
      break;
    case "moon":
      c.beginPath();
      c.arc(x, y, 30, 0.6, Math.PI * 2 - 0.6);
      c.arc(x + 20, y, 22, Math.PI * 2 - 1.1, 1.1, true);
      c.closePath();
      c.fillStyle = WASH.butter;
      c.fill();
      c.lineWidth = 2.2;
      c.stroke();
      break;
    case "date":
      c.translate(x, y);
      c.rotate(-0.1);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 40, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.6;
      c.beginPath();
      c.arc(0, 0, 33, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = ink;
      c.font = `italic 18px ${serif}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(dateText, 0, 1);
      break;
  }
  c.restore();
}

export function stampStrip(base: HTMLCanvasElement, out: HTMLCanvasElement, stamps: Stamp[], dateText: string) {
  const c = out.getContext("2d")!;
  const { serif } = siteFonts();
  c.drawImage(base, 0, 0);
  for (const s of stamps) drawStamp(c, s.kind, s.x, s.y, dateText, serif);
}

/**
 * A stand-in sitter for when there's no camera (or it's blocked): a simple
 * painted portrait that sways a little, so the booth still works and the
 * films have something to draw.
 */
export function paintSitter(c: CanvasRenderingContext2D, t: number) {
  const W = c.canvas.width;
  const H = c.canvas.height;
  const k = W / 640;
  const sw = Math.sin(t / 900) * 6 * k;
  c.fillStyle = "#d8c4bc";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#b89a90";
  for (let i = 0; i < 8; i++) c.fillRect((i * W) / 8, 0, W / 16, H);
  const blob = (x: number, y: number, rx: number, ry: number, col: string, a0 = 0, a1 = Math.PI * 2) => {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, a0, a1);
    c.fill();
  };
  blob(W * 0.5 + sw * 0.3, H * 1.05, 190 * k, 170 * k, "#3a2420");
  blob(W * 0.5 + sw, H * 0.44, 62 * k, 78 * k, "#e6c8b6");
  blob(W * 0.5 + sw, H * 0.33, 70 * k, 60 * k, "#2a1512", Math.PI, 0);
  c.fillRect(W * 0.5 + sw - 70 * k, H * 0.33, 22 * k, 90 * k);
  c.fillRect(W * 0.5 + sw + 48 * k, H * 0.33, 22 * k, 90 * k);
  c.fillStyle = "#5a3630";
  c.fillRect(W * 0.5 + sw - 28 * k, H * 0.43, 16 * k, 4 * k);
  c.fillRect(W * 0.5 + sw + 12 * k, H * 0.43, 16 * k, 4 * k);
  blob(W * 0.5 + sw, H * 0.55, 13 * k, 5 * k, "#a1574e");
}
