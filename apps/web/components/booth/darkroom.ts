import { EDGE, GRAPHITE, INK, PAPER, TINT, develop, type FilmId } from "@/lib/booth/film";

/**
 * The booth's viewfinder: the camera developed live, every frame, on the GPU.
 *
 * The camera frame is uploaded as a texture and one fragment shader runs per
 * output pixel. For the ink films it reads the 3 × 3 neighbourhood, takes the
 * Sobel gradient of brightness and turns strong edges into rose ink: the same
 * maths as lib/booth/film.ts, which the tests check. A 640 × 480 frame is
 * 307,200 pixels × 9 texture reads, done in well under a millisecond.
 *
 * Without WebGL2 it falls back to that TypeScript version at a lower size.
 */

export type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const v3 = (c: number[]) => `vec3(${c.map((x) => (x / 255).toFixed(4)).join(", ")})`;

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D cam;
uniform vec2 texel;     // one output pixel, in source uv
uniform vec4 crop;      // xy = offset, zw = scale: cover-fit the source into 4:3
uniform float mirror;   // 1 for a selfie camera
uniform int film;       // 0 ink, 1 tint, 2 pencil, 3 rose
const vec3 INK = ${v3(INK)};
const vec3 PAPER = ${v3(PAPER)};
const vec3 GRAPHITE = ${v3(GRAPHITE)};
vec2 at(vec2 q) { q.x = mix(q.x, 1.0 - q.x, mirror); return crop.xy + q * crop.zw; }
float lum(vec2 q) { vec3 c = texture(cam, at(q)).rgb; return dot(c, vec3(0.3, 0.59, 0.11)) * 255.0; }
void main() {
  vec2 d = texel;
  float tl = lum(uv + vec2(-d.x, -d.y)), t = lum(uv + vec2(0.0, -d.y)), tr = lum(uv + vec2(d.x, -d.y));
  float l = lum(uv + vec2(-d.x, 0.0)), r = lum(uv + vec2(d.x, 0.0));
  float bl = lum(uv + vec2(-d.x, d.y)), b = lum(uv + vec2(0.0, d.y)), br = lum(uv + vec2(d.x, d.y));
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  float edge = length(vec2(gx, gy));
  vec3 src = texture(cam, at(uv)).rgb;
  float y = dot(src, vec3(0.3, 0.59, 0.11)) * 255.0;
  vec3 paper = PAPER, ink = INK;
  float a;
  if (film == 3) {
    a = clamp((1.0 - y / 255.0 - 0.15) * 1.4, 0.0, 1.0);
  } else if (film == 2) {
    ink = GRAPHITE;
    vec2 px = floor(gl_FragCoord.xy);
    float hatch = (mod(px.x + px.y, 5.0) < 0.5 && y < 110.0) ? 0.35 : 0.0;
    a = max(clamp((edge - ${EDGE.pencil.from.toFixed(1)}) / ${EDGE.pencil.span.toFixed(1)}, 0.0, 1.0) * 0.8, hatch);
  } else {
    a = clamp((edge - ${EDGE.ink.from.toFixed(1)}) / ${EDGE.ink.span.toFixed(1)}, 0.0, 1.0);
    if (film == 1) paper = mix(PAPER, src, ${TINT.toFixed(2)});
  }
  o = vec4(mix(paper, ink, a), 1.0);
}`;

const FILM_INDEX: Record<FilmId, number> = { ink: 0, tint: 1, pencil: 2, rose: 3 };

export const VIEW = { w: 640, h: 480 };

function sourceSize(s: Source): [number, number] {
  if (s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight];
  if (s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  return [s.width, s.height];
}

/** Cover-fit a w × h source into 4:3: the part of it (in uv) to show. */
export function coverCrop(w: number, h: number): [number, number, number, number] {
  const want = VIEW.w / VIEW.h;
  const have = w / h;
  if (have > want) {
    const sx = want / have;
    return [(1 - sx) / 2, 0, sx, 1];
  }
  const sy = have / want;
  return [0, (1 - sy) / 2, 1, sy];
}

export interface Darkroom {
  readonly gpu: boolean;
  /** Develop one frame of `src` onto the darkroom's canvas. */
  draw(src: Source, film: FilmId, mirror: boolean): void;
}

export function createDarkroom(canvas: HTMLCanvasElement): Darkroom {
  canvas.width = VIEW.w;
  canvas.height = VIEW.h;
  // preserveDrawingBuffer: so a shot can be copied off the canvas after the frame is presented
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
  if (gl) {
    try {
      return glDarkroom(gl);
    } catch (e) {
      console.warn("Darkroom shader failed, using the CPU:", e);
    }
  }
  return cpuDarkroom(canvas);
}

function glDarkroom(gl: WebGL2RenderingContext): Darkroom {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, make(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  const loc = (n: string) => gl.getUniformLocation(prog, n);
  const u = { texel: loc("texel"), crop: loc("crop"), mirror: loc("mirror"), film: loc("film") };

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return {
    gpu: true,
    draw(src, film, mirror) {
      const [w, h] = sourceSize(src);
      if (!w || !h) return;
      gl.viewport(0, 0, VIEW.w, VIEW.h);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const crop = coverCrop(w, h);
      gl.uniform4f(u.crop, ...crop);
      // sample neighbours one *output* pixel apart, so line weight doesn't depend on the camera's resolution
      gl.uniform2f(u.texel, 1 / VIEW.w, 1 / VIEW.h);
      gl.uniform1f(u.mirror, mirror ? 1 : 0);
      gl.uniform1i(u.film, FILM_INDEX[film]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

function cpuDarkroom(canvas: HTMLCanvasElement): Darkroom {
  const out = canvas.getContext("2d")!;
  const work = document.createElement("canvas");
  work.width = VIEW.w / 2;
  work.height = VIEW.h / 2;
  const w = work.getContext("2d", { willReadFrequently: true })!;
  return {
    gpu: false,
    draw(src, film, mirror) {
      const [sw, sh] = sourceSize(src);
      if (!sw || !sh) return;
      const [cx, cy, cw, ch] = coverCrop(sw, sh);
      w.save();
      if (mirror) {
        w.translate(work.width, 0);
        w.scale(-1, 1);
      }
      w.drawImage(src, cx * sw, cy * sh, cw * sw, ch * sh, 0, 0, work.width, work.height);
      w.restore();
      const img = w.getImageData(0, 0, work.width, work.height);
      img.data.set(develop(img.data, work.width, work.height, film));
      w.putImageData(img, 0, 0);
      out.drawImage(work, 0, 0, VIEW.w, VIEW.h);
    },
  };
}
