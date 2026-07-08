import { ParticleField, DEFAULTS } from "./field.js?v=8";
import { attachParticleControls } from "./particle-controls.js?v=7";

const GENTLE = {
  flowAmp: 0.14,
  flowSpeed: 0.15,
  jitter: 0.03,
  rotSpeed: 0.05,
  glow: 6.8,
  brightness: 0.76,
  count: 15000,
  breathAmp: 0,
  breathSpeed: 0,
  glowOscAmp: 0,
};

const EMOTION_TUNING = {
  purple: { ...GENTLE },
  red: { ...GENTLE, flowAmp: 0.15, brightness: 0.78 },
  yellow: { ...GENTLE },
};

function mixRgb(a, b, t = 0.5) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function colorFromParams(params) {
  const base = params.base || DEFAULTS.color;
  const mid = params.mid || base;
  const hot = params.hot || mid;
  return mixRgb(mixRgb(base, mid, 0.55), hot, 0.25);
}

function blendTuning(a, b, t, out = {}) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) {
    const va = a?.[key];
    const vb = b?.[key];
    if (typeof va === "number" && typeof vb === "number") out[key] = va + (vb - va) * t;
    else out[key] = t < 0.5 ? va : vb;
  }
  return out;
}

export function attachSphereCore({ THREE, group, innerLayers = [], controlsRoot = null }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const field = new ParticleField(canvas, {
    ...DEFAULTS,
    count: 15000,
    scale: 0.58,
    background: [0, 0, 0, 0],
    breathAmp: 0,
    breathSpeed: 0,
    glowOscAmp: 0,
  });
  field.resize(512, 512, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 1;
  sprite.center.set(0.5, 0.5);
  group.add(sprite);

  for (const layer of innerLayers) layer.visible = false;

  let cycleSeg = null;
  let userOverrides = {};
  // Prototype layer: a named particle parameter set chosen from the UI.
  // Sits on top of the per-emotion tuning but below live slider tweaks,
  // and deliberately carries no color so it composes with the emotion dots.
  let prototypeParams = {};

  if (controlsRoot) {
    attachParticleControls(field, controlsRoot, {
      onChange: (patch) => {
        userOverrides = { ...userOverrides, ...patch };
      },
    });
  }

  return {
    sprite,
    field,
    setCycleBlend(seg) {
      cycleSeg = seg;
    },
    setPrototype(params) {
      prototypeParams = params || {};
      // Loading a prototype is a fresh preset: drop prior live slider tweaks
      // so the rendered look matches the (now re-synced) panel.
      userOverrides = {};
    },
    update(time, { params, scale = 1.8 }) {
      let tuning = { ...GENTLE, ...EMOTION_TUNING.red };
      const color = colorFromParams(params);

      if (cycleSeg) {
        const t = cycleSeg.t * cycleSeg.t * (3 - 2 * cycleSeg.t);
        const ta = EMOTION_TUNING[cycleSeg.a] || EMOTION_TUNING.purple;
        const tb = EMOTION_TUNING[cycleSeg.b] || EMOTION_TUNING.purple;
        tuning = blendTuning(ta, tb, t, {});
      } else if (params.emotion && EMOTION_TUNING[params.emotion]) {
        tuning = { ...GENTLE, ...EMOTION_TUNING[params.emotion] };
      } else {
        tuning = { ...GENTLE };
      }

      field.setParams({
        ...tuning,
        color,
        scale: DEFAULTS.scale,
        brightness: tuning.brightness,
        breathAmp: 0,
        breathSpeed: 0,
        glowOscAmp: 0,
        // Prototype can re-enable breathing etc.; live sliders still win.
        ...prototypeParams,
        ...userOverrides,
      });
      field.draw(time);

      texture.needsUpdate = true;
      sprite.scale.set(scale, scale, 1);
    },
  };
}
