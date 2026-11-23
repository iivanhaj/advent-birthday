/**
 * Door 6 · the photo booth. The films, as plain pixel maths.
 *
 * Every film turns a photograph into the site's own drawing style: rose ink
 * (#9E3B4C) on cream paper (#FBF1EE). The live viewfinder runs the same maths
 * in a WebGL2 fragment shader (components/booth/darkroom.ts); this TypeScript
 * version is the reference the shader is checked against, and the fallback
 * for browsers without WebGL2.
 *
 * The core of the ink films is the Sobel operator. For each pixel it weighs
 * the brightness of its 3 × 3 neighbourhood with two small kernels:
 *
 *        −1 0 +1              −1 −2 −1
 *   Gx = −2 0 +2         Gy =  0  0  0
 *        −1 0 +1              +1 +2 +1
 *
 * Gx is how fast brightness changes left to right, Gy top to bottom, and
 * |(Gx, Gy)| is how strongly an edge runs through the pixel. Edges become
 * ink; everything else stays paper. That is what an illustrator does too:
 * draw where things change, leave the rest.
 */

export type FilmId = "ink" | "tint" | "pencil" | "rose";

export const FILMS: { id: FilmId; label: string }[] = [
  { id: "ink", label: "Fine-line ink" },
  { id: "tint", label: "Ink, a hint of colour" },
  { id: "pencil", label: "Pencil" },
  { id: "rose", label: "Rose print" },
];

export const INK: RGB = [158, 59, 76];
export const PAPER: RGB = [251, 241, 238];
export const GRAPHITE: RGB = [70, 60, 62];
export type RGB = [number, number, number];

/** Edge strength where ink starts, and how quickly it reaches full ink (0–255 brightness units). */
export const EDGE = { ink: { from: 70, span: 110 }, pencil: { from: 40, span: 110 } };
/** How much of the photo's real colour the "hint of colour" film keeps. */
export const TINT = 0.2;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const luma = (r: number, g: number, b: number) => r * 0.3 + g * 0.59 + b * 0.11;

/** Sobel edge strength at (x, y) of a brightness image; 0 on the border. */
export function sobel(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 1 || y < 1 || x > w - 2 || y > h - 2) return 0;
  const i = y * w + x;
  const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
  const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
  return Math.hypot(gx, gy);
}

/** How much ink (0–1) a pixel gets, given its edge strength and brightness. */
export function inkAmount(film: FilmId, edge: number, lum: number, x: number, y: number): number {
  switch (film) {
    case "ink":
    case "tint":
      return clamp01((edge - EDGE.ink.from) / EDGE.ink.span);
    case "pencil": {
      // softer, earlier lines, plus diagonal hatching in the shadows
      const hatch = (x + y) % 5 === 0 && lum < 110 ? 0.35 : 0;
      return Math.max(clamp01((edge - EDGE.pencil.from) / EDGE.pencil.span) * 0.8, hatch);
    }
    case "rose":
      // a one-ink print: darker means more ink, with the highlights left as bare paper
      return clamp01((1 - lum / 255 - 0.15) * 1.4);
  }
}

/** Develop an RGBA image with a film. Returns a new buffer; the input is untouched. */
export function develop(src: Uint8ClampedArray, w: number, h: number, film: FilmId): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = luma(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
  const ink = film === "pencil" ? GRAPHITE : INK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const j = i * 4;
      const a = inkAmount(film, sobel(lum, w, h, x, y), lum[i], x, y);
      for (let c = 0; c < 3; c++) {
        const paper = film === "tint" ? PAPER[c] * (1 - TINT) + src[j + c] * TINT : PAPER[c];
        out[j + c] = Math.round(paper + (ink[c] - paper) * a);
      }
      out[j + 3] = 255;
    }
  }
  return out;
}
