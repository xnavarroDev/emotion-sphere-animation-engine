/**
 * firefly-field.js — the full-scene firefly environment from the official
 * emotion pages (official_anger / official_calm / official_sad / official
 * warm.html), ported as an editor module.
 *
 * Faithful to the official shader: particles spawn across the whole space
 * with staggered sqrt-distributed births (sparse start, quick fill, taper),
 * wander in place on three sines, blink on their own pow(sin,3) rhythm, and
 * render as additive core+aura sprites whose hot centres clip to white.
 * Depth comes from perspective point-size attenuation plus per-particle
 * "far" softening and brightness variance.
 *
 * All look parameters are live-tunable uniforms (no buffer rebuilds); count
 * changes only adjust the geometry draw range within a fixed pool.
 *
 * Usage:
 *   import { createFireflyField, FIREFLY_DEFAULTS } from './firefly-field.js';
 *   const ff = createFireflyField(THREE, { color: 0xffc24a, dpr: renderer.getPixelRatio() });
 *   scene.add(ff.points);
 *   // per frame: ff.update(elapsedSeconds);
 *   // live edits: ff.setParams({ intensity: 4 });  ff.setColor(0xff3b30);
 */

export const FIREFLY_DEFAULTS = {
  count: 120, // visible circles — sparse by default; the slider sets the on-screen maximum
  intensity: 3.0, // additive colour intensity — hot centres over-saturate to white
  size: 1.0, // global point-size multiplier
  blinkSpeed: 1.0, // twinkle rate multiplier
  blinkDepth: 1.0, // 0 = steady glow, 1 = official full-swing twinkle
  wander: 1.0, // in-place drift range multiplier
  spawnSpan: 26.0, // seconds over which the field populates (official value)
  hot: 1.0, // 0 = colour-true circles (hue never clips to white), 1 = official white-hot centres
  orbit: 0.0, // per-particle independent tumble: each circle roams its OWN random
              // axis, speed and direction (0 = off). This is what makes particles
              // within a layer diverge from each other, unlike the whole-layer spin.
  speed: 1.0, // global motion-rate multiplier: scales wander, orbit and blink together
              // (below 1 = slower, above 1 = faster). Does NOT affect spawnSpan/birth
              // pacing, so slowing motion doesn't also slow how fast the field fills in.
  radius: 1.6, // sphere shape: cluster radius (live uniform, animatable)
  coreBias: 1.0, // sphere shape: >1 packs circles toward the centre (rebuilds positions)
  spin: 0.0, // rad/s rigid rotation of this layer as a whole, about its own axis
             // (sign flips direction); read + applied externally by the caller.
             // Keep this SMALL — it moves every particle in lockstep; `orbit`
             // (above) is the per-particle independence control.
};

export const FIREFLY_POOL = 2200;

export function createFireflyField(THREE, opts = {}) {
  const params = { ...FIREFLY_DEFAULTS };
  for (const k of Object.keys(FIREFLY_DEFAULTS)) if (k in opts) params[k] = opts[k];
  // 'sphere' arranges the circles as a ball around the origin (the Emotion
  // Sphere itself); 'box' is the official pages' full-frame environment.
  const shape = opts.shape || 'sphere';

  const positions = new Float32Array(FIREFLY_POOL * 3);
  const scales = new Float32Array(FIREFLY_POOL); // per-particle size
  const phases = new Float32Array(FIREFLY_POOL); // blink/wander phase offset
  const speeds = new Float32Array(FIREFLY_POOL); // blink rate
  const rands = new Float32Array(FIREFLY_POOL); // birth-order random (sqrt-distributed in shader)
  const ranges = new Float32Array(FIREFLY_POOL); // wander radius
  const tempos = new Float32Array(FIREFLY_POOL); // wander speed
  const glows = new Float32Array(FIREFLY_POOL); // aura strength (few strong, most weak)
  const fars = new Float32Array(FIREFLY_POOL); // "distant" softening factor
  const brights = new Float32Array(FIREFLY_POOL); // brightness variance for depth

  function fillPositions() {
    if (shape === 'sphere') {
      // uniform direction, coreBias-shaped radius in a unit ball; the live
      // `radius` param scales it in the shader so radius changes are free
      for (let i = 0; i < FIREFLY_POOL; i++) {
        const i3 = i * 3;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const r = Math.pow(Math.random(), params.coreBias);
        positions[i3] = r * Math.sin(ph) * Math.cos(th);
        positions[i3 + 1] = r * Math.sin(ph) * Math.sin(th);
        positions[i3 + 2] = r * Math.cos(ph);
      }
    } else {
      // official pages' camera-facing spawn box (world units)
      const areaX = 22, areaY = 13, areaZ = 11;
      const centerBias = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      for (let i = 0; i < FIREFLY_POOL; i++) {
        const i3 = i * 3;
        positions[i3] = centerBias() * areaX;
        positions[i3 + 1] = centerBias() * areaY;
        positions[i3 + 2] = -1.0 - Math.random() * areaZ;
      }
    }
  }
  fillPositions();

  // In sphere mode the wander amplitude is scaled to the unit ball; the box
  // keeps the official world-unit range.
  const wanderScale = shape === 'sphere' ? 0.12 : 1.0;

  for (let i = 0; i < FIREFLY_POOL; i++) {
    scales[i] = (0.8 + Math.random() * 1.8) * 1.75;
    phases[i] = Math.random() * Math.PI * 2.0;
    speeds[i] = 0.5 + Math.random() * 1.5;
    // the first circle always appears alone: index 0 is born at t=0 and
    // everyone else waits at least ~8% of the spawn span before following
    rands[i] = i === 0 ? 0 : 0.0064 + Math.random() * 0.9936;
    ranges[i] = (0.4 + Math.random() * 1.0) * wanderScale;
    tempos[i] = 0.12 + Math.random() * 0.22;
    glows[i] = Math.pow(Math.random(), 3.0);
    fars[i] = Math.pow(Math.random(), 2.0);
    brights[i] = 0.35 + Math.pow(Math.random(), 1.6) * 1.85;
  }
  const indices = new Float32Array(FIREFLY_POOL);
  for (let i = 0; i < FIREFLY_POOL; i++) indices[i] = i;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rands, 1));
  geometry.setAttribute('aRange', new THREE.BufferAttribute(ranges, 1));
  geometry.setAttribute('aTempo', new THREE.BufferAttribute(tempos, 1));
  geometry.setAttribute('aGlow', new THREE.BufferAttribute(glows, 1));
  geometry.setAttribute('aFar', new THREE.BufferAttribute(fars, 1));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(brights, 1));
  geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));

  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(opts.color != null ? opts.color : 0xffc24a) },
    uIntensity: { value: params.intensity },
    uSize: { value: params.size },
    uBlinkSpeed: { value: params.blinkSpeed },
    uBlinkDepth: { value: params.blinkDepth },
    uWander: { value: params.wander },
    uSpawnSpan: { value: params.spawnSpan },
    uRadius: { value: params.radius },
    uDpr: { value: opts.dpr != null ? opts.dpr : 1 },
    uCount: { value: params.count }, // eased "soft count" — trails the target
    uCountFade: { value: 8 }, // width (in particles) of the soft edge
    uHot: { value: params.hot },
    uSpawnStart: { value: 0 }, // birth clock origin — respawn() resets it to "now"
    uSpawnWindow: { value: 0 }, // >0 overrides uSpawnSpan (used to fit the fill inside a loop)
    uOrbit: { value: params.orbit },
    uSpeed: { value: params.speed },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aScale;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aRand;
      attribute float aRange;
      attribute float aTempo;
      attribute float aGlow;
      attribute float aFar;
      attribute float aBright;
      attribute float aIndex;
      uniform float uTime;
      uniform float uSize;
      uniform float uBlinkSpeed;
      uniform float uBlinkDepth;
      uniform float uWander;
      uniform float uSpawnSpan;
      uniform float uSpawnStart;
      uniform float uSpawnWindow;
      uniform float uRadius;
      uniform float uDpr;
      uniform float uCount;
      uniform float uCountFade;
      uniform float uOrbit;
      uniform float uSpeed;
      varying float vAlpha;
      varying float vGlow;
      varying float vBlink;
      varying float vFar;
      varying float vBright;

      // cheap 1D hash -> [0,1); several calls with different seeds give
      // independent-looking pseudo-random numbers per particle
      float hash11(float p){
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }
      // Rodrigues' rotation formula: rotate v about unit axis by angle
      vec3 rotateAxis(vec3 v, vec3 axis, float angle){
        float s = sin(angle), c = cos(angle);
        return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
      }

      void main() {
        vGlow = aGlow;
        vFar = aFar;
        vBright = aBright;
        vec3 pos = position * uRadius;

        // uSpeed scales motion (wander, orbit, blink) without touching birth/
        // count-reveal timing below, which stays on the real clock
        float mt = uTime * uSpeed;

        // per-particle independent orbit: each circle tumbles about its OWN
        // random axis, at its own random speed and direction (unlike spin,
        // which turns the whole layer together) — this is the source of
        // genuine independence/randomness between particles in one layer
        if (uOrbit > 0.0001) {
          float hx = hash11(aRand * 12.9898 + 3.1);
          float hy = hash11(aRand * 78.233 + 4.7);
          float hz = hash11(aRand * 37.719 + 1.3);
          vec3 orbitAxis = normalize(vec3(hx, hy, hz) * 2.0 - 1.0 + 1e-4);
          float dirSign = hash11(aRand * 9.17 + 2.0) > 0.5 ? 1.0 : -1.0;
          float orbitSpeed = (0.4 + hash11(aRand * 5.53 + 0.6) * 1.2) * dirSign;
          pos = rotateAxis(pos, orbitAxis, mt * uOrbit * orbitSpeed);
        }

        // staggered births: sqrt distribution starts sparse and fills quickly,
        // each firefly fades in over its first second then stays lit
        float spawnSpan = uSpawnWindow > 0.0 ? uSpawnWindow : uSpawnSpan;
        float birthT = spawnSpan * sqrt(aRand);
        float age = (uTime - uSpawnStart) - birthT;
        float born = step(0.0, age);
        float fadeIn = smoothstep(0.0, 1.0, age);

        // in-place wander on three offset sines
        float t = mt * aTempo + aPhase;
        vec3 wander = vec3(
          sin(t * 0.9),
          sin(t * 1.1 + 1.7),
          sin(t * 0.7 + 3.1)
        );
        pos += wander * aRange * uWander;

        // firefly blink: dim most of the cycle with brief bright flashes
        float pulse = 0.5 + 0.5 * sin(mt * aSpeed * uBlinkSpeed + aPhase);
        float blink = pow(pulse, 3.0);
        // blinkDepth blends between a steady glow and the official full swing
        // (12% .. 100% brightness) so dense fields need not strobe
        float glow = mix(0.8, 0.12 + 0.95 * blink, uBlinkDepth);
        vBlink = blink * uBlinkDepth;

        // soft count edge: as the eased count sweeps past this particle's
        // index it fades with the same smoothstep as a birth. The threshold
        // is scattered per particle (up to ±15% of the current count) so
        // arrivals clump and gap organically like the load-time births,
        // instead of marching in index order at a uniform rate.
        float scatter = (fract(aRand * 71.7) - 0.5) * 0.3 * uCount;
        float countIn = clamp((uCount - (aIndex + scatter)) / max(uCountFade, 0.001), 0.0, 1.0);
        countIn = countIn * countIn * (3.0 - 2.0 * countIn);

        vAlpha = glow * fadeIn * born * countIn;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aScale * 32.0 * uSize * uDpr * (1.0 + aGlow * 1.4) * (1.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uHot;
      varying float vAlpha;
      varying float vGlow;
      varying float vBlink;
      varying float vFar;
      varying float vBright;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);

        float core = smoothstep(0.5, 0.0, d);  // crisp centre
        float aura = pow(core, 0.55);          // wide soft halo

        // every firefly gets a faint aura, strong ones wider; the aura
        // spreads slightly during a blink
        float auraAmt = 0.35 + vGlow * 1.0 + vBlink * 0.3;

        // distant fireflies lose their crisp centre and keep only soft aura
        float coreAmt = mix(1.0, 0.25, vFar);
        float shape = core * coreAmt + aura * (auraAmt + vFar * 0.5);
        float alpha = vAlpha * shape * (1.0 - 0.6 * vFar) * vBright;

        // uHot blends between colour-true circles (brightness variance only
        // in alpha, hue stays at uColor) and the official over-saturated
        // white-hot centres (channels clip toward white).
        vec3 col = uColor * mix(min(uIntensity, 1.0), uIntensity * (1.0 + vGlow * 2.5) * vBright, uHot);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // spawn box exceeds default bounding sphere

  function setParams(patch = {}) {
    const prevBias = params.coreBias;
    for (const [k, v] of Object.entries(patch)) {
      if (k in params && typeof v === 'number') params[k] = v;
    }
    params.count = Math.max(0, Math.min(FIREFLY_POOL, params.count));
    uniforms.uIntensity.value = params.intensity;
    uniforms.uSize.value = params.size;
    uniforms.uBlinkSpeed.value = params.blinkSpeed;
    uniforms.uBlinkDepth.value = params.blinkDepth;
    uniforms.uWander.value = params.wander;
    uniforms.uSpawnSpan.value = params.spawnSpan;
    uniforms.uRadius.value = params.radius;
    uniforms.uHot.value = params.hot;
    uniforms.uOrbit.value = params.orbit;
    uniforms.uSpeed.value = params.speed;
    // coreBias reshapes the distribution — rebuild spawn positions (CPU; only
    // on change, so skip it during animation lerps like the layers do)
    if (params.coreBias !== prevBias) {
      fillPositions();
      geometry.getAttribute('position').needsUpdate = true;
    }
  }
  setParams({});

  return {
    points,
    params,
    setParams,
    setColor(c) { uniforms.uColor.value.set(c); },
    color() { return uniforms.uColor.value; },
    setDpr(d) { uniforms.uDpr.value = d; },
    // Restart the staggered spawn-in from "now" — the same fill-in the field
    // plays on load. Pass a window (seconds) to complete the fill within it
    // (the animation engine fits the reveal inside the track's loop);
    // omit to use the spawnSpan param.
    respawn(window) {
      uniforms.uSpawnStart.value = uniforms.uTime.value;
      uniforms.uSpawnWindow.value = window > 0 ? window : 0;
    },
    update(t) {
      const dt = Math.min(Math.max(t - (this._lastT ?? t), 0), 0.1);
      this._lastT = t;
      // ease the visible count toward the target; the fade band is sized so
      // each circle crosses the soft edge in ~1s (the birth fade duration)
      const target = params.count;
      const prev = uniforms.uCount.value;
      const next = prev + (target - prev) * Math.min(1, dt * 4);
      const rate = dt > 0 ? Math.abs(next - prev) / dt : 0;
      uniforms.uCount.value = next;
      uniforms.uCountFade.value = Math.max(6, rate * 1.0);
      // draw range covers the scattered thresholds (+18%) and the fade band
      geometry.setDrawRange(0, Math.ceil(Math.min(FIREFLY_POOL,
        Math.max(next, target) * 1.18 + uniforms.uCountFade.value + 1)));
      uniforms.uTime.value = t;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
