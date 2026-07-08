import { SIMPLEX_NOISE_3D } from "./glsl.js";

// Deterministic PRNG (mulberry32) so a given `seed` always yields the same cloud.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULTS = {
  seed: 1,
  count: 30000,
  // blob geometry
  scale: 0.62, // radius of the field in NDC (relative to min canvas dimension)
  coreBias: 1.0, // >1 packs particles toward the center (near 1 = more even grain)
  edgeFeather: 0.18, // softness of the outer rim
  // motion
  flowAmp: 0.16, // displacement strength of the curl field
  flowFreq: 1.9, // spatial frequency of the filaments
  flowSpeed: 0.18, // temporal evolution speed of the flow
  // per-particle independent drift (on top of the shared flow field)
  jitter: 0.04, // amplitude of each particle's own wandering
  jitterSpeed: 0.6, // how fast each particle wanders on its own
  // rotation (wandering, non-uniform)
  rotSpeed: 0.06, // slow base drift (rad/s)
  rotWander: 0.9, // amplitude of the random rotation wobble (rad)
  rotWanderFreq: 0.09, // how fast the rotation direction wanders
  diffSwirl: 0.5, // differential rotation: inner vs outer rings twist at different rates
  breathAmp: 0.04, // radial breathing amplitude
  breathSpeed: 0.7,
  // look
  pointSize: 4.5, // sprite size; leaves room for the soft glow halo
  sizeJitter: 0.6,
  // glow pulses by +/- glowOscAmp around the slider value `glow`
  glow: 6.5, // center of the glow oscillation (the slider sets this)
  glowOscAmp: 1.0, // hover amount: glow ranges glow-1 .. glow+1
  glowOscSpeed: 0.8, // rad/s of the glow pulsing
  brightness: 0.8, // per-particle opacity / additive intensity
  // firefly-style life: per-particle blink + staggered population growth
  twinkle: 0, // 0 = steady glow, 1 = each particle blinks on its own rhythm
  twinkleSpeed: 1.0, // blink rate multiplier
  spawnSpan: 0, // seconds over which particles are born (0 = all visible at start)
  // Light blue sampled from the real Apple Quick Start reference (~#a0caef).
  color: [0.627, 0.792, 0.937],
  background: [0, 0, 0, 1], // black sensor backdrop
  // additive: glowing nebula over the dark backdrop (the sensor look).
  blendMode: "additive",
};

const VERT = (noise) => /* glsl */ `#version 300 es
precision highp float;

in vec2 a_base;     // base position in unit disk [-1,1]
in float a_seed;    // per-particle random [0,1)
in float a_bright;  // per-particle brightness multiplier

uniform float u_time;
uniform float u_aspect;     // width / height
uniform float u_scale;
uniform float u_edgeFeather;
uniform float u_flowAmp;
uniform float u_flowFreq;
uniform float u_flowSpeed;
uniform float u_jitter;
uniform float u_jitterSpeed;
uniform float u_rotSpeed;
uniform float u_rotWander;
uniform float u_rotWanderFreq;
uniform float u_diffSwirl;
uniform float u_breathAmp;
uniform float u_breathSpeed;
uniform float u_pointSize;
uniform float u_sizeJitter;
uniform float u_dpr;
uniform float u_fieldSeed;
uniform float u_twinkle;      // 0 = steady, 1 = full firefly blink
uniform float u_twinkleSpeed; // blink rate multiplier
uniform float u_spawnSpan;    // seconds over which particles are born (0 = all on)

out float v_alpha;
out float v_bright;

${noise}

void main(){
  vec2 p = a_base;
  float r0 = length(p);

  // swirling, divergence-free displacement (shared flow field)
  vec3 np = vec3(p * u_flowFreq + u_fieldSeed * 17.0, u_time * u_flowSpeed + u_fieldSeed);
  vec2 disp = curl2(np) * u_flowAmp;
  p += disp;

  // per-particle independent wander (each dot has its own seeded noise)
  vec2 indep = vec2(
    snoise(vec3(a_seed * 53.0, 11.3, u_time * u_jitterSpeed)),
    snoise(vec3(7.7, a_seed * 53.0, u_time * u_jitterSpeed))
  ) * u_jitter;
  p += indep;

  // breathing
  float breath = 1.0 + u_breathAmp * sin(u_time * u_breathSpeed + a_seed * 6.2831);
  p *= breath;

  // wandering, non-uniform rotation:
  //  - slow base drift
  //  - a low-frequency noise term that makes the spin speed up, slow down and reverse
  //  - differential swirl so inner and outer rings twist at different rates
  float wander = u_rotWander * snoise(vec3(u_fieldSeed * 5.0, 31.7, u_time * u_rotWanderFreq));
  float diff = u_diffSwirl * (1.0 - r0) * sin(u_time * 0.13 + u_fieldSeed * 7.0);
  float angle = u_time * u_rotSpeed + wander + diff;
  float ca = cos(angle);
  float sa = sin(angle);
  p = mat2(ca, -sa, sa, ca) * p;

  // keep the blob circular regardless of canvas aspect
  vec2 clip = p * u_scale;
  if (u_aspect >= 1.0) clip.x /= u_aspect; else clip.y *= u_aspect;

  gl_Position = vec4(clip, 0.0, 1.0);

  // feathered radial mask using the stable original radius
  float mask = 1.0 - smoothstep(1.0 - u_edgeFeather, 1.0, r0);
  v_alpha = mask;

  // per-particle twinkle: pow(...,3) keeps each dot dim most of its cycle
  // with brief bright flashes, each on its own rhythm (firefly look).
  float pulse = 0.5 + 0.5 * sin(u_time * (0.5 + a_seed * 1.5) * u_twinkleSpeed + a_seed * 41.0);
  float blink = pow(pulse, 3.0);
  v_alpha *= mix(1.0, 0.12 + 0.95 * blink, u_twinkle);

  // staggered birth: each particle gets a birth time in [0, spawnSpan],
  // sqrt-distributed so the field starts sparse, fills quickly, then tapers.
  // Fades in over its first second. spawnSpan = 0 disables (all on at t=0).
  float birthT = u_spawnSpan * sqrt(fract(a_seed * 337.73));
  float age = u_time - birthT;
  float fadeIn = smoothstep(0.0, 1.0, age) * step(0.0, age);
  v_alpha *= mix(1.0, fadeIn, step(0.001, u_spawnSpan));

  v_bright = a_bright;

  float sz = u_pointSize * (1.0 - u_sizeJitter + a_seed * u_sizeJitter * 2.0);
  gl_PointSize = max(1.0, sz * u_dpr);
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in float v_alpha;
in float v_bright;

uniform vec3 u_color;
uniform float u_brightness;
uniform float u_glow;
uniform int u_mode; // 0 = normal/over, 1 = additive, 2 = multiply

out vec4 fragColor;

void main(){
  // radial coordinate across the point sprite, 0 at center -> 1 at edge
  vec2 d = (gl_PointCoord - 0.5) * 2.0;
  float dist = length(d);
  if (dist > 1.0) discard;

  // crisp bright core (keeps the grain) + a soft halo whose size and
  // strength grow with u_glow (1 = no glow, 10 = very glowy).
  float g = clamp((u_glow - 1.0) / 9.0, 0.0, 1.0);
  float core = exp(-dist * dist * 16.0);
  float halo = exp(-dist * dist * mix(16.0, 2.0, g)) * mix(0.0, 0.5, g);
  float profile = max(core, halo);
  float strength = clamp(v_alpha * profile * u_brightness * v_bright, 0.0, 1.0);

  if (u_mode == 2) {
    // MULTIPLY: white where uncovered, tinted toward the color where covered.
    // Overlapping sprites multiply together, so stacked particles get darker.
    vec3 c = mix(vec3(1.0), u_color, strength);
    fragColor = vec4(c, 1.0);
  } else {
    // normal / additive use premultiplied alpha; hue stays constant so
    // overlapping particles build toward (and cap at) the light-blue color.
    vec3 col = u_color;
    fragColor = vec4(col * strength, strength);
  }
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
  }
  return s;
}

export class ParticleField {
  constructor(canvas, params = {}) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true, // needed so headless export can read the canvas
    });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;
    this.canvas = canvas;
    this.params = { ...DEFAULTS, ...params };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT(SIMPLEX_NOISE_3D)));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "program link failed");
    }
    this.prog = prog;

    this.loc = {
      a_base: gl.getAttribLocation(prog, "a_base"),
      a_seed: gl.getAttribLocation(prog, "a_seed"),
      a_bright: gl.getAttribLocation(prog, "a_bright"),
    };
    this.u = {};
    for (const name of [
      "u_time", "u_aspect", "u_scale", "u_edgeFeather", "u_flowAmp",
      "u_flowFreq", "u_flowSpeed", "u_jitter", "u_jitterSpeed", "u_rotSpeed",
      "u_rotWander", "u_rotWanderFreq", "u_diffSwirl", "u_breathAmp", "u_breathSpeed",
      "u_pointSize", "u_sizeJitter", "u_dpr", "u_fieldSeed", "u_color",
      "u_brightness", "u_glow", "u_mode", "u_twinkle", "u_twinkleSpeed", "u_spawnSpan",
    ]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }

    this.vao = gl.createVertexArray();
    this.buffers = {};
    this._buildParticles();
  }

  _buildParticles() {
    const gl = this.gl;
    const { count, coreBias, seed } = this.params;
    const rand = mulberry32(seed * 2654435761);

    const base = new Float32Array(count * 2);
    const seeds = new Float32Array(count);
    const bright = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // core-biased radius, uniform angle
      const r = Math.pow(rand(), coreBias);
      const a = rand() * Math.PI * 2;
      base[i * 2] = Math.cos(a) * r;
      base[i * 2 + 1] = Math.sin(a) * r;
      seeds[i] = rand();
      // brightness: mostly dim wisps, a few bright cores
      bright[i] = 0.4 + Math.pow(rand(), 2.0) * 1.6;
    }

    gl.bindVertexArray(this.vao);
    const mk = (loc, data, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    this.buffers.base = mk(this.loc.a_base, base, 2);
    this.buffers.seed = mk(this.loc.a_seed, seeds, 1);
    this.buffers.bright = mk(this.loc.a_bright, bright, 1);
    gl.bindVertexArray(null);
    this._count = count;
    this._drawCount = null; // reset soft cap on rebuild
  }

  // Override how many particles are drawn without rebuilding GPU buffers.
  // Pass null to restore full count. Clamped to allocated count.
  setDrawCount(n) {
    this._drawCount = n == null ? null : Math.min(Math.max(0, Math.floor(n)), this._count);
  }

  setParams(next = {}) {
    const prevSeed = this.params.seed;
    const prevBias = this.params.coreBias;
    this.params = { ...this.params, ...next };
    if (
      this.params.seed !== prevSeed ||
      this.params.coreBias !== prevBias ||
      this.params.count > this._count  // only rebuild when we need more particles than allocated
    ) {
      this._buildParticles();
    }
  }

  resize(width, height, dpr = 1) {
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this._dpr = dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(timeSec) {
    const gl = this.gl;
    const p = this.params;
    const bg = p.background;

    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Blend mode selects how stacked particles combine:
    //  - multiply: DST_COLOR, ZERO          -> overlaps darken (ink on white)
    //  - additive: ONE, ONE                 -> overlaps brighten (glow on dark)
    //  - normal  : ONE, ONE_MINUS_SRC_ALPHA -> plain over-compositing
    gl.enable(gl.BLEND);
    let mode = 0;
    if (p.blendMode === "multiply") {
      mode = 2;
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    } else if (p.blendMode === "additive") {
      mode = 1;
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      mode = 0;
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);

    const aspect = this.canvas.width / this.canvas.height;
    gl.uniform1f(this.u.u_time, timeSec);
    gl.uniform1f(this.u.u_aspect, aspect);
    gl.uniform1f(this.u.u_scale, p.scale);
    gl.uniform1f(this.u.u_edgeFeather, p.edgeFeather);
    gl.uniform1f(this.u.u_flowAmp, p.flowAmp);
    gl.uniform1f(this.u.u_flowFreq, p.flowFreq);
    gl.uniform1f(this.u.u_flowSpeed, p.flowSpeed);
    gl.uniform1f(this.u.u_jitter, p.jitter);
    gl.uniform1f(this.u.u_jitterSpeed, p.jitterSpeed);
    gl.uniform1f(this.u.u_rotSpeed, p.rotSpeed);
    gl.uniform1f(this.u.u_rotWander, p.rotWander);
    gl.uniform1f(this.u.u_rotWanderFreq, p.rotWanderFreq);
    gl.uniform1f(this.u.u_diffSwirl, p.diffSwirl);
    gl.uniform1f(this.u.u_breathAmp, p.breathAmp);
    gl.uniform1f(this.u.u_breathSpeed, p.breathSpeed);
    gl.uniform1f(this.u.u_pointSize, p.pointSize);
    gl.uniform1f(this.u.u_sizeJitter, p.sizeJitter);
    gl.uniform1f(this.u.u_dpr, this._dpr || 1);
    gl.uniform1f(this.u.u_fieldSeed, p.seed * 0.123);
    gl.uniform1f(this.u.u_twinkle, p.twinkle);
    gl.uniform1f(this.u.u_twinkleSpeed, p.twinkleSpeed);
    gl.uniform1f(this.u.u_spawnSpan, p.spawnSpan);
    gl.uniform3fv(this.u.u_color, p.color);
    gl.uniform1f(this.u.u_brightness, p.brightness);
    // glow hovers +/- glowOscAmp around the slider value
    const glow = p.glow + p.glowOscAmp * Math.sin(timeSec * p.glowOscSpeed);
    gl.uniform1f(this.u.u_glow, glow);
    gl.uniform1i(this.u.u_mode, mode);

    gl.drawArrays(gl.POINTS, 0, Math.min(this._drawCount ?? this.params.count, this._count));
    gl.bindVertexArray(null);
  }
}
