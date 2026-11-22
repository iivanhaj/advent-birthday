/**
 * Draws the infinite bloom on the GPU (WebGL2): one instanced quad per
 * flower, and a fragment shader that draws the flower mathematically.
 *
 * Each petal is a signed distance field: for every pixel, how far it is from
 * the petal's edge (negative inside). That one number gives a crisp ink
 * outline of exactly the same pixel width at any size, a paper fill that
 * hides the flower underneath, or a soft glow for the glass look. So a
 * flower drawn at 4 px and one drawn at 4,000 px are equally sharp.
 *
 * Instances arrive in the walk's order, parents first, so children are
 * drawn over the petal they sit in.
 */

export type BloomTheme = "ink" | "glass";

const VS = `#version 300 es
layout(location = 0) in vec2 corner;      // −1…1 quad
layout(location = 1) in vec4 flower;      // x, y, size, rot (px, px, px, rad)
layout(location = 2) in float level;
uniform vec2 viewport;
uniform float reach;
out vec2 local;     // position in flower units, unrotated (petal 0 points up)
out float sizePx;
out float lvl;
void main() {
  vec2 p = corner * reach;
  float c = cos(flower.w), s = sin(flower.w);
  vec2 world = flower.xy + flower.z * vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  local = p;
  sizePx = flower.z;
  lvl = level;
  gl_Position = vec4(world / viewport * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 local;
in float sizePx;
in float lvl;
out vec4 color;
uniform float petals;
uniform int theme;        // 0 ink, 1 glass
uniform float dpr;
uniform float phase;      // zoom phase t, so colours drift smoothly with depth
const float PI = 3.14159265;
const vec3 PAPER = vec3(0.984, 0.945, 0.933);
const vec3 INK = vec3(0.62, 0.231, 0.298);

// distance to a petal of length L and width W, in its own frame (axis along +x)
float petal(vec2 q, float L, float W) {
  float u = clamp(q.x / L, 0.0, 1.0);
  // max(…, 0): past the tip sin(π) comes out a hair below zero, and pow() of a negative is NaN
  float halfW = W * L * pow(max(sin(PI * u), 0.0), 0.75) * (1.0 - 0.28 * u);
  return max(abs(q.y) - halfW, max(-q.x, q.x - L));
}
// fold the plane into one of n equal sectors, turned by \`offset\` sectors (axis 0 = straight up)
vec2 fold(vec2 p, float n, float offset) {
  float step = 2.0 * PI / n;
  float a = atan(p.y, p.x) + PI * 0.5 - offset * step;
  a -= step * floor(a / step + 0.5);
  float r = length(p);
  return vec2(r * cos(a), r * sin(a));
}
// coverage of a line of half-width w (flower units) at distance d, antialiased over aa
float stroke(float d, float w, float aa) { return 1.0 - smoothstep(w, w + aa, abs(d)); }
float fill(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }
vec3 hue(float h) {
  vec3 k = vec3(0.0, 2.0 / 3.0, 1.0 / 3.0);
  return clamp(abs(fract(h + k) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
  vec2 p = local;
  vec2 q1 = fold(p, petals, 0.0);
  vec2 q2 = fold(p, petals, 0.5);
  float outer = petal(q1, 1.0, 0.34);
  float inner = petal(q2, 0.62, 0.26);
  float centre = length(p) - 0.15;
  float px = sizePx / dpr;                 // flower units → CSS px
  float aa = 1.0 / max(px, 1e-3);          // one CSS px, in flower units

  if (theme == 0) {
    // fine-line ink: paper fills hide what's underneath; ink lines keep the same
    // pixel width at every size (thinner for tiny flowers). Back to front:
    float w = clamp(px / 80.0, 0.35, 1.7) * aa * 0.5;
    // small flowers fade their ink instead of filling up with it
    float inkA = clamp((px - 6.0) / 40.0, 0.12, 1.0);
    vec3 ink = mix(PAPER, INK, inkA);
    vec4 c = vec4(0.0);
    c = mix(c, vec4(PAPER, 1.0), fill(outer, aa));                                   // outer petals
    // a vein down each petal, only while the flower is a sensible size (on huge ones it'd be a straight line across the screen)
    float vein = (px > 40.0 && px < 700.0 && q1.x > 0.12 && q1.x < 0.7) ? stroke(q1.y, w * 0.5, aa) * fill(outer, aa) : 0.0;
    c = mix(c, vec4(ink, 1.0), max(stroke(outer, w, aa), vein * 0.5));
    c = mix(c, vec4(PAPER, 1.0), fill(inner, aa));                                   // inner petals
    c = mix(c, vec4(ink, 1.0), stroke(inner, w, aa));
    c = mix(c, vec4(PAPER, 1.0), fill(centre, aa));                                  // centre
    float stamens = px > 40.0 ? fill(length(fold(p, 12.0, 0.0) - vec2(0.09, 0.0)) - 0.014, aa) : 0.0;
    c = mix(c, vec4(ink, 1.0), max(stroke(centre, w, aa), stamens));
    if (c.a < 0.003) discard;
    color = vec4(c.rgb * c.a, c.a);   // premultiplied alpha
  } else {
    // glass: translucent petals that add light to whatever is behind; colour drifts with depth
    vec3 col = hue(fract((lvl - phase) * 0.11 + 0.83)) * 0.55 + 0.45;
    // flowers much bigger than the screen are faint panes; detail comes from the mid-sized ones,
    // otherwise the stacked ancestors' light washes the night out
    float weight = clamp(500.0 / px, 0.06, 1.0);
    float body = fill(outer, aa) * mix(0.015, 0.12, clamp(q1.x, 0.0, 1.0));
    float rim = exp(-abs(outer) / max(aa * 1.2, 0.003)) * 0.65;
    float bodyI = fill(inner, aa) * mix(0.02, 0.14, clamp(q2.x / 0.62, 0.0, 1.0));
    float rimI = exp(-abs(inner) / max(aa * 1.2, 0.003)) * 0.5;
    float core = exp(-length(p) / 0.1) * 0.7;
    vec3 light = (col * (body + rim + bodyI + rimI) + vec3(1.0, 0.92, 0.78) * core) * weight;
    float fadeIn = clamp(px / 6.0, 0.0, 1.0);   // tiny flowers fade in rather than pop
    color = vec4(light * fadeIn, 0.0);
  }
}`;

export class BloomRenderer {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private instances: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private capacity = 0;

  static create(canvas: HTMLCanvasElement): BloomRenderer | null {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    try {
      return new BloomRenderer(gl);
    } catch {
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, make(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    this.program = p;
    for (const n of ["viewport", "reach", "petals", "theme", "dpr", "phase"]) this.loc[n] = gl.getUniformLocation(p, n);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instances = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 20, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  /** Draw `count` flowers (x, y, size, rot, level in device px) from `data`. */
  draw(data: Float32Array, count: number, o: { theme: BloomTheme; petals: number; dpr: number; phase: number }) {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    if (o.theme === "glass") gl.clearColor(0.043, 0.035, 0.094, 1);
    else gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    if (o.theme === "glass") gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);
    gl.uniform2f(this.loc.viewport, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(this.loc.reach, 1.03);
    gl.uniform1f(this.loc.petals, o.petals);
    gl.uniform1i(this.loc.theme, o.theme === "ink" ? 0 : 1);
    gl.uniform1f(this.loc.dpr, o.dpr);
    gl.uniform1f(this.loc.phase, o.phase);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    const bytes = count * 20;
    if (bytes > this.capacity) {
      this.capacity = Math.max(bytes, this.capacity * 2);
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 5);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  }
}
