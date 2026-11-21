/**
 * The pond's water surface, simulated on the GPU (WebGL2).
 *
 * The surface is a height field on a grid. Each step solves the 2D wave
 * equation with finite differences, for every cell at once in a fragment
 * shader:
 *
 *   next = (left + right + up + down) / 2 − previous      (then × damping)
 *
 * Two float textures take turns being "now" and "before" (ping-pong). Drops
 * (clicks, koi wakes, a new koi splashing in) add small Gaussian bumps.
 *
 * Rendering then reads the surface's slope and curvature:
 *   slope     → shifts where each pixel looks into the pond floor (refraction),
 *   curvature → brightens where ripples would focus sunlight (caustics),
 *   normal    → a soft specular highlight.
 * The koi are NOT drawn through this: they swim just under the surface in a
 * crisp layer of their own, so the water never blurs them.
 */

export type WaterLook = {
  tint: [number, number, number];
  caustic: number;
  refraction: number;
  spec: [number, number, number];
  specStrength: number;
  water: [number, number, number, number]; // rgb + how much of it to mix in
};

const QUAD = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const MAX_DROPS = 64;

const SIM = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D state;      // r = height now, g = height one step ago
uniform vec2 texel;
uniform vec4 drops[${MAX_DROPS}]; // xy = position (0–1), z = strength, w = radius
uniform int dropCount;
uniform float damping;
void main() {
  vec4 here = texture(state, uv);
  float sum = texture(state, uv + vec2(texel.x, 0.0)).r + texture(state, uv - vec2(texel.x, 0.0)).r
            + texture(state, uv + vec2(0.0, texel.y)).r + texture(state, uv - vec2(0.0, texel.y)).r;
  float next = (sum * 0.5 - here.g) * damping;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= dropCount) break;
    vec2 d = (uv - drops[i].xy) / texel / drops[i].w;
    next += drops[i].z * exp(-dot(d, d));
  }
  o = vec4(next, here.r, 0.0, 1.0);
}`;

const RENDER = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D state;
uniform sampler2D floorTex;
uniform vec2 texel;
uniform vec3 tint;
uniform float caustic;
uniform float refraction;
uniform vec3 spec;
uniform float specStrength;
uniform vec4 water;
void main() {
  float c = texture(state, uv).r;
  float l = texture(state, uv - vec2(texel.x, 0.0)).r, r = texture(state, uv + vec2(texel.x, 0.0)).r;
  float d = texture(state, uv - vec2(0.0, texel.y)).r, u = texture(state, uv + vec2(0.0, texel.y)).r;
  vec2 slope = vec2(r - l, u - d);
  vec2 fuv = vec2(uv.x, 1.0 - uv.y) + slope * refraction * vec2(1.0, -1.0);
  vec3 col = texture(floorTex, fuv).rgb * tint;
  float focus = clamp(-(l + r + u + d - 4.0 * c) * 9.0, 0.0, 1.0);
  col += caustic * focus * vec3(1.0, 1.0, 0.92);
  col = mix(col, water.rgb, water.a);
  vec3 n = normalize(vec3(-slope * 5.0, 1.0));
  col += spec * pow(max(dot(n, normalize(vec3(0.35, 0.5, 1.0))), 0.0), 80.0) * specStrength;
  o = vec4(col, 1.0);
}`;

export class Water {
  readonly gl: WebGL2RenderingContext;
  private sim: WebGLProgram;
  private draw: WebGLProgram;
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private floorTex: WebGLTexture;
  private now = 0;
  private drops: [number, number, number, number][] = [];
  private loc = new Map<string, WebGLUniformLocation | null>();
  readonly gridW: number;
  readonly gridH: number;

  /** null when the browser can't do float render targets (the pond then skips the water effects). */
  static create(canvas: HTMLCanvasElement, gridW = 256, gridH = 160): Water | null {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, antialias: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;
    try {
      return new Water(gl, gridW, gridH);
    } catch {
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext, gridW: number, gridH: number) {
    this.gl = gl;
    this.gridW = gridW;
    this.gridH = gridH;
    this.sim = this.program(SIM);
    this.draw = this.program(RENDER);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < 2; i++) {
      const t = this.texture();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, gridW, gridH, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("float framebuffer unsupported");
      this.tex.push(t);
      this.fbo.push(f);
    }
    this.floorTex = this.texture();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private texture() {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private program(fs: string) {
    const gl = this.gl;
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, make(gl.VERTEX_SHADER, QUAD));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    return p;
  }

  private u(p: WebGLProgram, name: string) {
    const key = `${p === this.sim ? "s" : "r"}:${name}`;
    if (!this.loc.has(key)) this.loc.set(key, this.gl.getUniformLocation(p, name));
    return this.loc.get(key)!;
  }

  /** A disturbance at (x, y) in 0–1 pond coordinates (y down). Radius is in grid cells. */
  drop(x: number, y: number, strength: number, radius = 2.2) {
    if (this.drops.length < 512) this.drops.push([x, 1 - y, strength, radius]);
  }

  /** Advance the surface by `substeps` wave steps. */
  step(substeps = 2, damping = 0.984) {
    const gl = this.gl;
    gl.useProgram(this.sim);
    gl.viewport(0, 0, this.gridW, this.gridH);
    gl.uniform2f(this.u(this.sim, "texel"), 1 / this.gridW, 1 / this.gridH);
    gl.uniform1f(this.u(this.sim, "damping"), damping);
    for (let s = 0; s < substeps; s++) {
      const batch = s === 0 ? this.drops.splice(0, MAX_DROPS) : [];
      const arr = new Float32Array(MAX_DROPS * 4);
      batch.forEach((d, i) => arr.set(d, i * 4));
      gl.uniform4fv(this.u(this.sim, "drops"), arr);
      gl.uniform1i(this.u(this.sim, "dropCount"), batch.length);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1 - this.now]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[this.now]);
      gl.uniform1i(this.u(this.sim, "state"), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.now = 1 - this.now;
    }
  }

  /** Draw the pond floor (a 2D canvas) seen through the current surface. */
  render(floor: HTMLCanvasElement, look: WaterLook) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(this.draw);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.now]);
    gl.uniform1i(this.u(this.draw, "state"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.floorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floor);
    gl.uniform1i(this.u(this.draw, "floorTex"), 1);
    gl.uniform2f(this.u(this.draw, "texel"), 1 / this.gridW, 1 / this.gridH);
    gl.uniform3fv(this.u(this.draw, "tint"), look.tint);
    gl.uniform1f(this.u(this.draw, "caustic"), look.caustic);
    gl.uniform1f(this.u(this.draw, "refraction"), look.refraction);
    gl.uniform3fv(this.u(this.draw, "spec"), look.spec);
    gl.uniform1f(this.u(this.draw, "specStrength"), look.specStrength);
    gl.uniform4fv(this.u(this.draw, "water"), look.water);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    const gl = this.gl;
    this.tex.forEach((t) => gl.deleteTexture(t));
    this.fbo.forEach((f) => gl.deleteFramebuffer(f));
    gl.deleteTexture(this.floorTex);
    gl.deleteProgram(this.sim);
    gl.deleteProgram(this.draw);
  }
}
