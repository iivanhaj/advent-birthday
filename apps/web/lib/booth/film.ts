/**
 * Door 6 · the photo booth. The films, as plain pixel maths.
 *
 * Two films, the way a real booth would load them:
 *
 *   rose     the photo printed in a single rose ink on cream paper: dark
 *            areas take more ink, highlights stay bare paper;
 *   classic  a black-and-white booth print: a gentle S-curve, film grain and
 *            slightly darker corners.
 *
 * The live viewfinder runs this on the GPU (components/booth/darkroom.ts, the
 * same formulas in GLSL); this TypeScript version is the reference the tests
 * check, and the fallback for browsers without WebGL2.
 *
 * Both start from the same measurement of each pixel: its brightness,
 * normalised by the whole frame's average (so a dim room and a bright one
 * print alike) and blurred very slightly (σ = 1 px), which smooths away
 * webcam noise before it turns into speckled ink.
 */

export type FilmId = "rose" | "classic";

export const FILMS: { id: FilmId; label: string }[] = [
  { id: "rose", label: "Rose print" },
  { id: "classic", label: "Classic booth" },
];

export type RGB = [number, number, number];
/** Colours as 0–1 floats (the shader's units). */
export const INK: RGB = [158 / 255, 59 / 255, 76 / 255];
export const PAPER: RGB = [251 / 255, 241 / 255, 238 / 255];
export const SILVER_DARK: RGB = [0.09, 0.07, 0.07];
export const SILVER_LIGHT: RGB = [0.96, 0.94, 0.9];

/** Denoising blur, in output pixels (the viewfinder is 640 × 480). */
export const SIGMA = 1.0;
/** Exposure: scale brightness so the frame averages this, within these gains. */
export const EXPOSURE = { target: 0.46, min: 0.7, max: 2.2 };
/** Rose print: brightness below which ink starts, and how steeply it builds. */
export const ROSE = { lift: 0.12, slope: 1.45, grain: 0.06 };
/** Classic: the tonal curve's ends, the grain, and how much the corners darken. */
export const CLASSIC = { black: 0.04, white: 0.96, grain: 0.07, vignette: 0.35 };

export const luma = (r: number, g: number, b: number) => r * 0.3 + g * 0.59 + b * 0.11;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Brightness gain for a frame whose average brightness is `mean`. */
export const exposureGain = (mean: number) => Math.min(EXPOSURE.max, Math.max(EXPOSURE.min, EXPOSURE.target / Math.max(mean, 1e-3)));

/** A cheap per-pixel hash in [0, 1): film grain that doesn't need a texture. The shader has the same one. */
export function grain(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** One output pixel of a film, from its (normalised, lightly blurred) brightness `v` at viewfinder pixel (x, y). Returns RGB in 0–1. */
export function shade(film: FilmId, v: number, x: number, y: number): RGB {
  const n = grain(x, y) - 0.5;
  if (film === "rose") {
    const ink = (1 - v - ROSE.lift) * ROSE.slope;
    return mix3(PAPER, INK, clamp01(ink + n * ROSE.grain));
  }
  const cx = x / 640 - 0.5;
  const cy = y / 480 - 0.5;
  const vignette = 1 - CLASSIC.vignette * (cx * cx + cy * cy) * 2;
  return mix3(SILVER_DARK, SILVER_LIGHT, clamp01(smoothstep(CLASSIC.black, CLASSIC.white, v) * vignette + n * CLASSIC.grain));
}

/** 1D Gaussian kernel of standard deviation `sigma`, radius ⌈3σ⌉, summing to 1. */
export function gaussian(sigma: number): number[] {
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  return k.map((v) => v / sum);
}

/** Separable Gaussian blur of a w × h single-channel image (edges clamp). */
export function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const k = gaussian(sigma);
  const r = (k.length - 1) / 2;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += src[y * w + Math.min(w - 1, Math.max(0, x + i))] * k[i + r];
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * k[i + r];
      out[y * w + x] = s;
    }
  return out;
}

/**
 * Develop an RGBA image with a film (the CPU path). `scale` is output pixels
 * per pixel of this image, so a half-size image uses a half-size blur and
 * still matches the GPU version.
 */
export function develop(src: Uint8ClampedArray, w: number, h: number, film: FilmId, scale = 1): Uint8ClampedArray {
  const n = w * h;
  const lum = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += lum[i] = luma(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) / 255;
  const gain = exposureGain(sum / n);
  for (let i = 0; i < n; i++) lum[i] = clamp01(lum[i] * gain);
  const v = blur(lum, w, h, SIGMA / scale);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = shade(film, v[i], x * scale, y * scale);
      out.set([Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), 255], i * 4);
    }
  return out;
}
