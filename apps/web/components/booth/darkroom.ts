import { CLASSIC, EXPOSURE, INK, PAPER, ROSE, SIGMA, SILVER_DARK, SILVER_LIGHT, develop, type FilmId } from "@/lib/booth/film";

/**
 * The booth's viewfinder: the camera developed live, every frame, on the GPU.
 *
 * Three fragment-shader passes over a 640 × 480 frame:
 *
 *   1. across  read the camera (cover-cropped, mirrored for a selfie),
 *              normalise its exposure by the frame's average brightness (the
 *              top level of the texture's mipmap chain *is* that average),
 *              and blur brightness slightly left–right to calm webcam noise;
 *   2. down    the same blur up–down (a Gaussian is separable, so two 1D
 *              passes do the work of one 2D pass with far fewer reads);
 *   3. film    print it: rose ink on cream, or a black-and-white booth print.
 *
 * Pass 3 is the same maths as lib/booth/film.ts `shade()`, which the tests
 * check and which runs on the CPU when there's no WebGL2.
 */

export type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
export const VIEW = { w: 640, h: 480 };

const FILM_INDEX: Record<FilmId, number> = { rose: 0, classic: 1 };
const v3 = (c: number[]) => `vec3(${c.map((x) => x.toFixed(4)).join(", ")})`;
const f = (x: number) => x.toFixed(4);

/** Gaussian weights as a GLSL array literal. */
function kernel(sigma: number) {
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const s = k.reduce((a, b) => a + b, 0);
  return { r, glsl: `float[${k.length}](${k.map((v) => f(v / s)).join(", ")})` };
}
const K = kernel(SIGMA);
const blurLoop = (sample: string) => `float k[${2 * K.r + 1}] = ${K.glsl};
  float s = 0.0;
  for (int i = -${K.r}; i <= ${K.r}; i++) s += ${sample} * k[i + ${K.r}];`;

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const ACROSS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D cam;
uniform vec4 crop;
uniform float mirror;
uniform float maxLod;
vec2 at(vec2 q) { q.x = mix(q.x, 1.0 - q.x, mirror); return crop.xy + clamp(q, 0.0, 1.0) * crop.zw; }
void main() {
  float mean = dot(textureLod(cam, vec2(0.5), maxLod).rgb, vec3(0.3, 0.59, 0.11));
  float gain = clamp(${f(EXPOSURE.target)} / max(mean, 0.001), ${f(EXPOSURE.min)}, ${f(EXPOSURE.max)});
  vec2 d = vec2(1.0 / ${VIEW.w}.0, 0.0);
  ${blurLoop("clamp(dot(texture(cam, at(uv + float(i) * d)).rgb, vec3(0.3, 0.59, 0.11)) * gain, 0.0, 1.0)")}
  o = vec4(s, s, s, 1.0);
}`;

// render targets store rows bottom-up and the camera top-down, so reading one back flips y
const DOWN = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src;
vec2 flip(vec2 q) { return vec2(q.x, 1.0 - q.y); }
void main() {
  vec2 d = vec2(0.0, 1.0 / ${VIEW.h}.0);
  ${blurLoop("texture(src, flip(uv + float(i) * d)).r")}
  o = vec4(s, s, s, 1.0);
}`;

const FILM = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D blurred;
uniform int film;
const vec3 INK = ${v3(INK)};
const vec3 PAPER = ${v3(PAPER)};
const vec3 SILVER_DARK = ${v3(SILVER_DARK)};
const vec3 SILVER_LIGHT = ${v3(SILVER_LIGHT)};
float grain(vec2 p) { return fract(sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453); }
void main() {
  float v = texture(blurred, vec2(uv.x, 1.0 - uv.y)).r;
  // viewfinder pixel, top-left origin (the CPU version's x, y)
  vec2 px = vec2(floor(uv.x * ${VIEW.w}.0), floor(uv.y * ${VIEW.h}.0));
  float n = grain(px) - 0.5;
  vec3 c;
  if (film == 0) {
    float ink = (1.0 - v - ${f(ROSE.lift)}) * ${f(ROSE.slope)};
    c = mix(PAPER, INK, clamp(ink + n * ${f(ROSE.grain)}, 0.0, 1.0));
  } else {
    vec2 q = px / vec2(${VIEW.w}.0, ${VIEW.h}.0) - 0.5;
    float vignette = 1.0 - ${f(CLASSIC.vignette)} * dot(q, q) * 2.0;
    c = mix(SILVER_DARK, SILVER_LIGHT, clamp(smoothstep(${f(CLASSIC.black)}, ${f(CLASSIC.white)}, v) * vignette + n * ${f(CLASSIC.grain)}, 0.0, 1.0));
  }
  o = vec4(c, 1.0);
}`;

function sourceSize(s: Source): [number, number] {
  if (s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight];
  if (s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  return [s.width, s.height];
}

/** Cover-fit a w × h source into 4:3: the part of it (in uv) to show. Wide sources crop the sides evenly. */
export function coverCrop(w: number, h: number): [number, number, number, number] {
  const want = VIEW.w / VIEW.h;
  const have = w / h;
  if (have > want) {
    const sx = want / have;
    return [(1 - sx) / 2, 0, sx, 1];
  }
  // a tall photo: keep the top part, where the face usually is
  const sy = have / want;
  return [0, (1 - sy) * 0.22, 1, sy];
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
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  const program = (fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  };
  const across = program(ACROSS);
  const down = program(DOWN);
  const film = program(FILM);
  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // the camera, with a mipmap chain (its top level is the frame's average colour)
  const cam = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, cam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // two half-float targets for the blur passes (finer than 8 bits, so shadows don't band)
  const float = !!gl.getExtension("EXT_color_buffer_float");
  const target = () => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, VIEW.w, VIEW.h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, VIEW.w, VIEW.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("blur target incomplete");
    return { t, fb };
  };
  const A = target();
  const B = target();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    gpu: true,
    draw(src, filmId, mirror) {
      const [w, h] = sourceSize(src);
      if (!w || !h) return;
      const crop = coverCrop(w, h);
      gl.viewport(0, 0, VIEW.w, VIEW.h);
      gl.bindVertexArray(vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cam);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);

      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
      gl.useProgram(across);
      gl.uniform1i(U(across, "cam"), 0);
      gl.uniform4f(U(across, "crop"), ...crop);
      gl.uniform1f(U(across, "mirror"), mirror ? 1 : 0);
      gl.uniform1f(U(across, "maxLod"), Math.floor(Math.log2(Math.max(w, h))));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
      gl.useProgram(down);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, A.t);
      gl.uniform1i(U(down, "src"), 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(film);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, B.t);
      gl.uniform1i(U(film, "blurred"), 1);
      gl.uniform1i(U(film, "film"), FILM_INDEX[filmId]);
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
      img.data.set(develop(img.data, work.width, work.height, film, 2));
      w.putImageData(img, 0, 0);
      out.drawImage(work, 0, 0, VIEW.w, VIEW.h);
    },
  };
}
