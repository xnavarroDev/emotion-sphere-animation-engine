const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Scene state, particles, motion, rendering, and layer lifecycle.

test('scene color helpers convert, clamp, and blend colors', async () => {
  const { hexToRgb, mixHex, rgbToHex } = await importAppModule('scene', 'color.js');
  expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  expect(rgbToHex([1.2, -0.5, 0.5])).toBe('#ff0080');
  expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
});

test('scene palette helpers build isolated gradients and bounded tints', async () => {
  const palette = await importAppModule('scene', 'palette.js');
  const emotion = palette.emotionPalette({
    shadowHex: '#000000',
    deepHex: '#202020',
    baseHex: '#808080',
    midHex: '#c0c0c0',
    highlightHex: '#ffffff',
  });
  const copy = palette.copyEmotion(emotion, ['shadow', 'deep', 'base', 'mid', 'highlight']);
  copy.base[0] = 0;
  expect(emotion.base[0]).toBeCloseTo(128 / 255);

  const stops = palette.buildStops(emotion, emotion);
  const coreColor = palette.emotionCoreRgb({
    base: [0, 0, 0], mid: [0.4, 0.6, 0.8], hot: [1, 1, 1],
  });
  expect(coreColor[0]).toBeCloseTo(0.415);
  expect(coreColor[1]).toBeCloseTo(0.4975);
  expect(coreColor[2]).toBeCloseTo(0.58);
  const sampled = [0, 0, 0];
  palette.sampleStops(0.4, stops, sampled);
  expect(sampled.every(value => value >= 0 && value <= 1)).toBe(true);
  palette.sampleStops(2, stops, sampled);
  expect(sampled).toEqual([0, 0, 0]);

  // Tint helpers mutate caller-provided scratch arrays to avoid allocations in
  // the per-particle render loop; every variant must still return finite RGB.
  for (const apply of [
    out => palette.tintCyanGlow(0.4, 0.5, 0.6, 0.2, 0.1, out),
    out => palette.tintRedShell(0.4, 0.5, 0.6, 0.2, out),
    out => palette.tintWarmShell(0.4, 0.5, 0.6, 0.2, out),
    out => palette.tintYellowShell(0.4, 0.5, 0.6, 0.2, out),
    out => palette.tintPurpleGlow(0.4, 0.5, 0.6, 0.2, out),
  ]) {
    const out = [0, 0, 0];
    apply(out);
    expect(out.every(Number.isFinite)).toBe(true);
    expect(out.every(value => value >= 0 && value <= 1)).toBe(true);
  }
});

test('sphere-core prototypes preserve the baseline while returning isolated defaults', async () => {
  const { createCorePrototypes } = await importAppModule('scene', 'core-prototypes.js');
  const first = createCorePrototypes();
  const second = createCorePrototypes();

  expect(Object.keys(first)).toEqual(['core', 'dense', 'flow', 'breath']);
  expect(first.dense.count).toBeGreaterThan(first.core.count);
  expect(first.flow.flowAmp).toBeGreaterThan(first.core.flowAmp);
  expect(first.breath.breathAmp).toBeGreaterThan(first.core.breathAmp);
  first.core.scale = 99;
  expect(second.core.scale).toBe(0.58);
  expect(second.dense.scale).toBe(0.58);
});

test('emotion catalog returns mutable presets without changing authored defaults', async () => {
  const { COLOR_KEYS, EMOTIONS, emotionPreset, LOCKED_PARAMS } = await importAppModule('scene', 'emotions.js');
  const red = emotionPreset('red');
  expect(red.size).toBe(LOCKED_PARAMS.red.size);
  expect(COLOR_KEYS).toContain('base');
  expect(red.base).not.toBe(EMOTIONS.red.base);

  red.base[0] = 0;
  red.size = 99;
  const nextRed = emotionPreset('red');
  expect(nextRed.base).toEqual(EMOTIONS.red.base);
  expect(nextRed.size).toBe(LOCKED_PARAMS.red.size);
});

test('emotion cycle composes wrapped segments, targets, and paint weights', async () => {
  const cycle = await importAppModule('scene', 'emotion-cycle.js');
  expect(cycle.getCycleSegment(0)).toEqual({ a: 'blue', b: 'purple', t: 0 });
  expect(cycle.getCycleSegment(-0.125)).toEqual({ a: 'yellow', b: 'blue', t: 0.5 });
  expect(cycle.isHardCycleSegment({ a: 'purple', b: 'red' })).toBe(true);

  const composed = cycle.composeCycleTarget(0.125);
  expect(composed.segment).toEqual({ a: 'blue', b: 'purple', t: 0.5 });
  expect(composed.activeEmotion).toBe('purple');
  expect(composed.target.label).toContain('BLUE 50%');
  expect(composed.target.base.every(Number.isFinite)).toBe(true);

  const weights = cycle.getCycleStyleWeights(composed.segment);
  expect(weights.wa + weights.wb).toBeCloseTo(1);
  expect(weights.colorSt).toBeGreaterThanOrEqual(0);
  const paint = cycle.getCyclePaintWeights(weights);
  expect(paint.wCalmBlue + paint.wOrbs).toBeCloseTo(1);
  expect(cycle.emotionPick(null, 'purple', 'purple')).toBe(1);
});

test('emotion transition eases numeric state and handles cycle palette boundaries', async () => {
  const cycle = await importAppModule('scene', 'emotion-cycle.js');
  const { emotionPreset } = await importAppModule('scene', 'emotions.js');
  const current = emotionPreset('blue');
  const target = emotionPreset('red');
  current.pulse = 0;
  current.base = [0, 0, 0];

  cycle.advanceEmotionTransition(current, target, { cycleOn: false });
  expect(current.pulse).toBeCloseTo(target.pulse * 0.02);
  expect(current.base).toEqual([0, 0, 0]);
  expect(current.pulseMode).toBe(target.pulseMode);

  cycle.advanceEmotionTransition(current, target, {
    cycleOn: true,
    segment: { a: 'purple', b: 'red' },
  });
  expect(current.pulse).toBeCloseTo(target.pulse * 0.216);
  expect(current.base[0]).toBeCloseTo(target.base[0] * 0.045);

  target.mid = undefined;
  cycle.advanceEmotionTransition(current, target, {
    cycleOn: true,
    segment: { a: 'red', b: 'yellow' },
  });
  expect(current.mid).toBeUndefined();
});

test('emotion state keeps selection, cycle clock, segment, and weights coherent', async () => {
  const { createEmotionState } = await importAppModule('scene', 'emotion-state.js');
  const state = createEmotionState({ initialEmotion: 'blue' });

  expect(state).toMatchObject({ activeEmotion: 'blue', cycleOn: false });
  expect(state.styleWeights()).toBeNull();
  const selected = state.select('red');
  expect(state).toMatchObject({ activeEmotion: 'red', cycleOn: false });
  expect(state.params).not.toBe(selected);
  expect(state.target.edgeFlickerAmt).toBe(Number(Boolean(selected.edgeFlicker)));

  state.startCycle(1000);
  const firstSegment = { ...state.cycleSegment };
  expect(state.cycleOn).toBe(true);
  expect(state.styleWeights()).not.toBeNull();
  expect(state.paintWeights()).not.toBeNull();
  expect(state.tickCycle(4000)).toBe(true);
  expect(state.cycleSegment).not.toEqual(firstSegment);

  state.select('yellow');
  expect(state.tickCycle(5000)).toBe(false);
  expect(state.activeEmotion).toBe('yellow');
});

test('scene frame runner keeps particle, trail, presentation, and render stages ordered', async () => {
  const { createSceneFrameRunner } = await importAppModule('scene', 'scene-frame-runner.js');
  const calls = [];
  const shellPosition = { array: [1], needsUpdate: false };
  const innerPosition = { array: [2], needsUpdate: false };
  const innerSize = { needsUpdate: false };
  const innerColor = { needsUpdate: false };
  const frameState = {
    sphere: {}, breath: 0.5, radius: 2, density: 0.8, shimmer: 0.2,
    particleSize: 4, pulseFrequency: 3, chaosFrequency: 0.4,
    shardsWeight: 0, calmWeight: 1, purpleWeight: 0, redWeight: 0,
    yellowWeight: 0, edgeWeight: 0, chaosMotionWeight: 0,
    chaosShellWeight: 0, chaosInnerWeight: 0, motionNormalization: 1,
    chaosDisplacement: 0,
  };
  const operations = {
    advanceEmotionTransition: () => calls.push('transition'),
    deriveParticleFrameState: () => { calls.push('derive'); return frameState; },
    updateParticleMaterialAppearance: () => calls.push('materials'),
    updateShellParticlePositions: () => calls.push('shell'),
    updateInnerParticlePositions: options => {
      calls.push('inner');
      options.resetTrail(0);
    },
    applyParticleVisibility: () => calls.push('visibility'),
    updateSpherePresentation: options => calls.push(['presentation', options.core]),
  };
  const runner = createSceneFrameRunner({
    classic: {},
    shell: { origin: [], phases: [], positionAttribute: shellPosition },
    inner: {
      origin: [], phases: [], axes: [], births: [], visibility: [1], colors: [1],
      positionAttribute: innerPosition, sizeAttribute: innerSize, colorAttribute: innerColor,
    },
    materials: {},
    particleSpawner: { advance: (...args) => calls.push(['spawn', ...args]) },
    particleTrails: {
      resetPrevious: index => calls.push(['trail-reset', index]),
      update: options => calls.push(['trails', options.deltaTime]),
    },
    sphereRotation: { step: options => calls.push(['rotation', options.deltaTime]) },
    presentation: { cloud: {}, getCore: () => 'core', group: {} },
    getState: () => ({
      params: { glowSize: 1, glowOp: 1, autoSpeed: 0.1 },
      target: { chaos: 0 }, cycleOn: false, cycleSegment: null,
      activeEmotion: 'blue', spawnEnabled: true, cycleWeights: null,
      paintWeights: null, rotationEnabled: true, rotationSpeed: 0.2, scrubbing: false,
    }),
    updateColors: () => calls.push('colors'),
    updateInnerLayers: (...args) => calls.push(['layers', ...args]),
    render: () => calls.push('render'),
    operations,
  });

  const result = runner.run(2);
  expect(result.deltaTime).toBe(0.05);
  expect(result.frameState).toBe(frameState);
  expect(shellPosition.needsUpdate).toBe(true);
  expect(innerPosition.needsUpdate).toBe(true);
  expect(innerSize.needsUpdate).toBe(true);
  expect(innerColor.needsUpdate).toBe(true);
  expect(calls).toEqual([
    ['spawn', 0.05, 2], 'transition', 'derive', 'materials', 'shell', 'inner',
    ['trail-reset', 0], 'colors', 'visibility', ['trails', 0.05],
    ['rotation', 0.05], ['presentation', 'core'], ['layers', 0.05, 0.05], 'render',
  ]);

  expect(runner.setAnimationSpeed(2)).toBe(2);
  calls.length = 0;
  runner.run(2.03);
  const layerCall = calls.find(call => Array.isArray(call) && call[0] === 'layers');
  expect(layerCall[1]).toBeCloseTo(0.11);
  expect(layerCall[2]).toBeCloseTo(0.06);
  expect(runner.setAnimationSpeed(0)).toBe(1);
  expect(runner.setAnimationSpeed(-5)).toBe(0.1);
  expect(runner.setAnimationSpeed(99)).toBe(4);
});

test('particle frame state normalizes selected and cycling emotion inputs', async () => {
  const { deriveParticleFrameState } = await importAppModule('scene', 'particle-frame-state.js');
  const cycle = await importAppModule('scene', 'emotion-cycle.js');
  const selected = deriveParticleFrameState({
    cycleWeights: null,
    paintWeights: null,
    cycleOn: false,
    target: { pulseMode: 'heartbeat', silverStyle: 'shards', pulse: 2, chaos: 0.4, edgeFlicker: true },
    params: { chaosFreq: 0, radius: Number.NaN, density: 0, size: Number.NaN },
  });
  expect(selected.redWeight).toBe(1);
  expect(selected.shardsWeight).toBe(1);
  expect(selected.edgeWeight).toBe(1);
  expect(selected.radius).toBe(1.5);
  expect(selected.density).toBe(0.5);
  expect(selected.particleSize).toBe(2);
  expect(selected.pulseFrequency).toBeCloseTo(Math.PI * 5);

  const cycleWeights = cycle.getCycleStyleWeights({ a: 'blue', b: 'purple', t: 0.5 });
  const cycling = deriveParticleFrameState({
    cycleWeights,
    paintWeights: cycle.getCyclePaintWeights(cycleWeights),
    cycleOn: true,
    target: { pulseMode: 'wave', pulse: 6.5, chaos: 0.2, edgeFlickerAmt: 0.35 },
    params: { chaosFreq: 0.8, radius: 2, density: 0.7, size: 4 },
  });
  expect(cycling.calmWeight + cycling.purpleWeight).toBeCloseTo(1);
  expect(cycling.motionNormalization).toBeCloseTo(1);
  expect(cycling.edgeWeight).toBe(0.35);
  expect(Object.values(cycling.sphere).every(Number.isFinite)).toBe(true);
});

test('particle material helper adds per-vertex sizing without replacing stock shader behavior', async () => {
  const { patchPerVertexPointSize } = await importAppModule('scene', 'particle-materials.js');
  const material = { size: 2, needsUpdate: false };
  patchPerVertexPointSize(material, 'aSize');
  const shader = { vertexShader: '#include <common>\nvoid main(){\n#include <pointsize>\n}' };
  material.onBeforeCompile(shader);
  expect(shader.vertexShader).toContain('attribute float aSize;');
  expect(shader.vertexShader).toContain('gl_PointSize *= aSize;');
  expect(shader.vertexShader).toContain('#include <pointsize>');
  expect(material.customProgramCacheKey()).toBe('pvSize:aSize:2');
  expect(material.needsUpdate).toBe(true);
});

test('particle appearance synchronizes shell, glow, and halo materials', async () => {
  const { updateParticleMaterialAppearance } = await importAppModule('scene', 'particle-appearance.js');
  const materials = {
    shell: {}, inner: {}, glow: {}, halo2: {}, halo3: {},
  };
  updateParticleMaterialAppearance({
    time: 1.25, pulseFrequency: 2, particleSize: 5, density: 0.7,
    glowSize: 0.03, glowOpacity: 0.4,
    sphere: { breath: 0.5 }, breath: 0.5,
    classic: { shellSize: 1, dotSize: 1, glowSize: 1 }, edgeWeight: 0.3,
    calmWeight: 0.4, purpleWeight: 0.3, redWeight: 0.2, yellowWeight: 0.1,
    chaosMotionWeight: 0.3, chaosShellWeight: 0.15, materials,
  });
  for (const material of Object.values(materials)) {
    expect(Number.isFinite(material.size)).toBe(true);
    expect(Number.isFinite(material.opacity)).toBe(true);
  }
  expect(materials.halo2.size).toBeCloseTo(materials.glow.size * 1.55);
  expect(materials.halo3.size).toBeCloseTo(materials.glow.size * 2.25);
  expect(materials.shell.opacity).toBeGreaterThanOrEqual(0.28);
  expect(materials.glow.opacity).toBeLessThanOrEqual(0.9);
});

test('particle effect waveforms are deterministic and finite', async () => {
  const effects = await importAppModule('scene', 'particle-effects.js');
  const args = [1.2, 0.4, -0.2, 0.6, 0.1];
  for (const name of ['cyanDropletGlow', 'purpleEmpathyGlow', 'yellowShellGlow', 'yellowSparkFlicker']) {
    const first = effects[name](...args);
    expect(effects[name](...args)).toEqual(first);
    expect(Object.values(first).every(Number.isFinite)).toBe(true);
  }
  expect(effects.redShellGlow(...args, 3)).toEqual(effects.redShellGlow(...args, 3));
  expect(effects.redShardSparkle(...args, 3)).toEqual(effects.redShardSparkle(...args, 3));
  expect(Number.isFinite(effects.specularShine(1, 0, 0, 1, 0, 0, 8, 0.5))).toBe(true);
  expect(Number.isFinite(effects.particleSparkle(...args, 3, false))).toBe(true);
});

test('particle color renderer updates shell and inner buffers from one state snapshot', async () => {
  const { applyParticleVisibility, createParticleColorRenderer } = await importAppModule('scene', 'particle-colors.js');
  const { emotionPreset } = await importAppModule('scene', 'emotions.js');
  const { getCycleStyleWeights } = await importAppModule('scene', 'emotion-cycle.js');
  const makeGroup = (origin, extra = {}) => ({
    count: 1,
    origin: new Float32Array(origin),
    phase: new Float32Array([0.3]),
    colors: new Float32Array(3),
    geometry: { attributes: { color: { needsUpdate: false } } },
    ...extra,
  });
  const shell = makeGroup([0.8, 0.2, 0.1]);
  const inner = makeGroup([0.3, 0.1, 0.2], { sequenceTint: new Uint8Array([1]) });
  const red = emotionPreset('red');
  let stateReads = 0;
  const renderer = createParticleColorRenderer({
    shell,
    inner,
    getState: () => {
      stateReads += 1;
      return {
        params: red,
        target: red,
        activeEmotion: 'red',
        cycleWeights: getCycleStyleWeights({ a: 'purple', b: 'red', t: 0.25 }),
      };
    },
  });

  renderer.update(1.25);
  expect(stateReads).toBe(1);
  expect([...shell.colors, ...inner.colors].every(Number.isFinite)).toBe(true);
  expect([...shell.colors, ...inner.colors].some(value => value > 0)).toBe(true);
  expect(shell.geometry.attributes.color.needsUpdate).toBe(true);
  expect(inner.geometry.attributes.color.needsUpdate).toBe(true);

  const faded = new Float32Array([1, 0.5, 0.25, 0.8, 0.6, 0.4]);
  expect(applyParticleVisibility(faded, new Float32Array([0.5, 1]))).toBe(faded);
  expect(faded).toEqual(new Float32Array([0.5, 0.25, 0.125, 0.8, 0.6, 0.4]));
});

test('inner-layer presentation preserves timeline color ownership and seek state', async () => {
  const { updateInnerLayerPresentation } = await importAppModule('scene', 'inner-layer-presentation.js');
  const calls = [];
  const canvasLayer = {
    overrides: { blue: [0, 0, 0], purple: [1, 1, 1] },
    field: { params: {}, draw: time => calls.push(['draw', time]) },
    sprite: { visible: true }, tex: { needsUpdate: false },
  };
  const liveColor = { lerp: (target, amount) => calls.push(['live-color', target.value, amount]) };
  const firefly = {
    _phaseColourActive: true,
    overrides: {},
    color: () => liveColor,
    update: time => calls.push(['update', time]),
    setSpawnAge: (...args) => calls.push(['spawn-age', ...args]),
    anim: true,
    timeline: [
      { duration: 1, snapshot: { params: {} } },
      { duration: 3, snapshot: { params: {} } },
    ],
    params: { spawnSpan: 2, spin: 0.5, speed: 2 },
    spinAxis: { name: 'axis' },
    points: { rotateOnAxis: (...args) => calls.push(['spin', ...args]) },
  };
  const makeScratchColor = () => ({
    value: null,
    set(value) { this.value = value; return this; },
    lerp(other, amount) { this.value = ['mix', this.value, other.value, amount]; return this; },
  });
  const result = updateInnerLayerPresentation({
    time: 4, deltaTime: 0.1, canvasLayers: [canvasLayer], fireflyLayers: [firefly],
    cycleSegment: { a: 'blue', b: 'purple', t: 0.5 }, activeEmotion: 'purple',
    getActiveColor: () => [0.2, 0.3, 0.4], getEmotionCoreColor: () => [0.5, 0.5, 0.5],
    defaultFireflyColors: { blue: 0x0000ff, purple: 0x8800ff },
    targetColor: makeScratchColor(), blendColor: makeScratchColor(), seekHold: 1.5,
    applyAnimationFrame: delta => calls.push(['animation', delta, firefly._phaseColourActive]),
  });
  expect(result.blend).toBeCloseTo(0.5);
  expect(canvasLayer.field.params.color).toEqual([0.5, 0.5, 0.5]);
  expect(canvasLayer.tex.needsUpdate).toBe(true);
  expect(calls[0]).toEqual(['animation', 0.1, false]);
  expect(calls).toContainEqual(['spawn-age', 1.5, 2]);
  expect(calls).toContainEqual(['spin', firefly.spinAxis, 0.1]);
  expect(calls.some(call => call[0] === 'live-color')).toBe(true);
});

test('layer factories construct canvas sprites and disposable firefly fields', async () => {
  const {
    createCanvasParticleLayers, createFireflyLayerFactory,
  } = await importAppModule('scene', 'layer-factories.js');
  const calls = [];
  const documentLike = {
    createElement() {
      return {
        width: 0, height: 0,
        getContext: () => ({
          fillStyle: '',
          fillRect: (...args) => calls.push(['fill', ...args]),
          createLinearGradient: (...args) => ({
            addColorStop: (...stop) => calls.push(['stop', ...stop]), args,
          }),
        }),
      };
    },
  };
  class CanvasTexture { constructor(canvas) { this.canvas = canvas; } }
  class SpriteMaterial { constructor(options) { this.options = options; } }
  class Sprite {
    constructor(material) {
      this.material = material;
      this.center = { set: (...args) => calls.push(['center', ...args]) };
      this.scale = { set: (...args) => calls.push(['scale', ...args]) };
    }
  }
  class Vector3 { constructor(x, y, z) { Object.assign(this, { x, y, z }); } }
  class ParticleField {
    constructor(canvas, options) { this.canvas = canvas; this.options = options; }
    resize(...args) { calls.push(['resize', ...args]); }
  }
  const group = {
    add: value => calls.push(['add', value]),
    remove: value => calls.push(['remove', value]),
  };
  const THREE = {
    CanvasTexture, SpriteMaterial, Sprite, Vector3,
    LinearFilter: 'linear', AdditiveBlending: 'additive',
  };
  const canvasLayers = createCanvasParticleLayers({
    THREE, documentLike, ParticleField, defaults: { count: 10 },
    presets: [{ count: 20 }], group,
  });
  expect(canvasLayers).toHaveLength(1);
  expect(canvasLayers[0].field.options).toMatchObject({
    count: 20, background: [0, 0, 0, 0], glowOscAmp: 0,
  });
  expect(canvasLayers[0].tex.premultiplyAlpha).toBe(true);
  expect(calls).toContainEqual(['resize', 512, 512, 1]);

  const disposed = [];
  const makeFirefly = (_three, options) => ({
    params: { count: options.count || 30 },
    points: {
      visible: false,
      geometry: { dispose: () => disposed.push('geometry') },
      material: { dispose: () => disposed.push('material') },
    },
  });
  const factory = createFireflyLayerFactory({
    THREE, createFireflyField: makeFirefly, group, pixelRatio: 2,
    getActiveEmotion: () => 'red', getSphereMode: () => 'circles',
    defaultColors: { red: 0xff0000 }, createTimeline: () => ['timeline'], maxLayers: 8,
  });
  const firefly = factory.create({ count: 40 }, { blue: '#0000ff' });
  expect(firefly.points.visible).toBe(true);
  expect(firefly.overrides).toEqual({ blue: '#0000ff' });
  expect(firefly.timeline).toEqual(['timeline']);
  expect(firefly.idle).toEqual({ count: 40 });
  expect(Object.values(firefly.spinAxis).every(Number.isFinite)).toBe(true);
  factory.dispose(firefly);
  expect(disposed).toEqual(['geometry', 'material']);
  expect(calls.some(call => call[0] === 'remove' && call[1] === firefly.points)).toBe(true);
});

test('particle motion primitives keep swirl and jitter deterministic', async () => {
  const {
    FLAT_SPHERE_BREATH, PARTICLE_SWIRL, innerJitter, inwardSwirl,
  } = await importAppModule('scene', 'particle-motion.js');
  const args = [1.2, 0.4, -0.2, 0.6, 0.1, 0.3];
  const first = innerJitter(...args);
  expect(innerJitter(...args)).toEqual(first);
  expect(Object.values(first).every(Number.isFinite)).toBe(true);
  expect(FLAT_SPHERE_BREATH).toEqual({
    breath: 0.5, swell: 0, scale: 1, disperse: 0, innerScale: 1,
  });
  expect(Object.isFrozen(FLAT_SPHERE_BREATH)).toBe(true);

  const swirl = inwardSwirl(
    1.25, 0.4, 0.5, -0.25, 0.75, 0.94,
    PARTICLE_SWIRL.shellTangential,
    PARTICLE_SWIRL.shellInward,
  );
  expect(Object.values(swirl).every(Number.isFinite)).toBe(true);
  expect(swirl.radScale).toBeGreaterThanOrEqual(0.42);
  expect(inwardSwirl(1.25, 0.4, 0.5, -0.25, 0.75, 0.94, 0.14, 0.32)).toEqual(swirl);
});

test('particle integrators update finite buffers and enforce inner birth state', async () => {
  const {
    updateInnerParticlePositions, updateShellParticlePositions,
  } = await importAppModule('scene', 'particle-integrator.js');
  const origin = new Float32Array([0.5, -0.25, 0.75, -0.4, 0.8, 0.2]);
  const phases = new Float32Array([0.2, 1.1]);
  const sphere = { breath: 0.5, swell: 0, scale: 1, disperse: 0, innerScale: 1 };
  const classic = { scale: 1, life: 5, fade: 1, swirl: 0.3 };
  const shared = {
    time: 1.25, pulseFrequency: 2, radius: 1.5, sphere, classic, origin, phases,
    calmWeight: 0.4, purpleWeight: 0.3, redWeight: 0.2, yellowWeight: 0.1,
    motionNormalization: 1, shimmer: 0.02, chaosFrequency: 0.5,
  };

  const shellPositions = new Float32Array(6);
  updateShellParticlePositions({
    ...shared, positions: shellPositions, chaosWeight: 0.15, chaosAmount: 0.01,
  });
  expect([...shellPositions].every(Number.isFinite)).toBe(true);
  expect([...shellPositions].some(value => value !== 0)).toBe(true);

  const innerPositions = new Float32Array(6);
  const visibility = new Float32Array(2);
  const births = new Float32Array([-1, 0]);
  const resetIndexes = [];
  updateInnerParticlePositions({
    ...shared, now: 5.5, breath: 0.5, positions: innerPositions,
    axes: new Float32Array([0, 1, 0, 1, 0, 0]), births, visibility,
    spawnEnabled: true, resetTrail: index => resetIndexes.push(index),
    chaosWeight: 0.15, shardsWeight: 0.25, targetChaos: 0.2, chaosDisplacement: 0.01,
  });
  expect([...innerPositions]).toEqual([0, 0, 0, 0, 0, 0]);
  expect([...visibility]).toEqual([0, 0]);
  expect([...births]).toEqual([-1, -1]);
  expect(resetIndexes).toEqual([0, 1]);

  updateInnerParticlePositions({
    ...shared, now: 1, breath: 0.5, positions: innerPositions,
    axes: new Float32Array([0, 1, 0, 1, 0, 0]), births, visibility,
    spawnEnabled: false, resetTrail: () => {}, chaosWeight: 0.15,
    shardsWeight: 0.25, targetChaos: 0.2, chaosDisplacement: 0.01,
  });
  expect([...innerPositions].every(Number.isFinite)).toBe(true);
  expect([...visibility]).toEqual([1, 1]);
});

test('classic renderer settings return mutable values without mutating future defaults', async () => {
  const { createClassicRendererSettings } = await importAppModule('scene', 'classic-renderer-settings.js');
  const first = createClassicRendererSettings({ interval: 2 });
  const second = createClassicRendererSettings();

  expect(first.interval).toBe(2);
  expect(second.interval).toBe(0.65);
  first.coreBias = 99;
  expect(createClassicRendererSettings().coreBias).toBe(0.45);
});

test('classic particle state initializes lifecycle buffers and rerolls with live core bias', async () => {
  const { createClassicParticleState } = await importAppModule('scene', 'classic-particle-state.js');
  const values = [0.1, 0.6, 0.25, 0.2, 0.7, 0.9, 0.4];
  let cursor = 0;
  let coreBias = 1;
  const state = createClassicParticleState({
    count: 2,
    getCoreBias: () => coreBias,
    random: () => values[cursor++ % values.length],
  });

  expect(state.positions).toHaveLength(6);
  expect(state.colors).toHaveLength(6);
  expect([...state.births]).toEqual([-1, -1]);
  expect([...state.visibility]).toEqual([1, 1]);
  expect([...state.sizes]).toEqual([1, 1]);
  expect([...state.positions].every(Number.isFinite)).toBe(true);
  expect([...state.axes].every(Number.isFinite)).toBe(true);

  const radius = index => Math.hypot(
    state.origins[index * 3],
    state.origins[index * 3 + 1],
    state.origins[index * 3 + 2],
  );
  const firstRadius = radius(0);
  coreBias = 2;
  cursor = 0;
  state.rollParticle(0);
  expect(radius(0)).toBeLessThan(firstRadius);
  expect(state.positions.slice(0, 3)).toEqual(state.origins.slice(0, 3));
});

test('shell particle state creates a finite jittered Fibonacci sphere', async () => {
  const { createShellParticleState } = await importAppModule('scene', 'shell-particle-state.js');
  expect(() => createShellParticleState({ count: 1 })).toThrow('at least 2');
  const state = createShellParticleState({ count: 8, random: () => 0.5 });

  expect(state.positions).toHaveLength(24);
  expect(state.colors).toHaveLength(24);
  expect(state.phases).toHaveLength(8);
  expect(state.positions).toEqual(state.origins);
  expect([...state.positions].every(Number.isFinite)).toBe(true);
  for (let index = 0; index < 8; index += 1) {
    const offset = index * 3;
    expect(Math.hypot(
      state.origins[offset],
      state.origins[offset + 1],
      state.origins[offset + 2],
    )).toBeCloseTo(0.995, 5);
  }
});

test('particle spawner accumulates time and reuses slots in round-robin order', async () => {
  const { createParticleSpawner } = await importAppModule('scene', 'particle-spawner.js');
  const births = [];
  const spawner = createParticleSpawner({
    particleCount: 3,
    getInterval: () => 0.1,
    onSpawn: (index, time) => births.push([index, time]),
  });
  spawner.advance(0.25, 4);
  expect(births).toEqual([[0, 4], [1, 4]]);
  expect(spawner.pendingTime).toBeCloseTo(0.05);
  spawner.advance(0.2, 5);
  expect(births.slice(2)).toEqual([[2, 5], [0, 5]]);

  spawner.reset();
  spawner.advance(0.1, 6);
  expect(births.at(-1)).toEqual([0, 6]);
});

test('particle trail system emits, fades, expires, and dirties GPU buffers', async () => {
  const { createParticleTrailSystem } = await importAppModule('scene', 'particle-trails.js');
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(name, attribute) { this.attributes[name] = attribute; }
  }
  class BufferAttribute {
    constructor(array, itemSize) { Object.assign(this, { array, itemSize, needsUpdate: false }); }
  }
  class PointsMaterial { constructor(options) { this.options = options; } }
  class Points { constructor(geometry, material) { Object.assign(this, { geometry, material }); } }
  const group = { add(value) { this.child = value; } };
  const trails = createParticleTrailSystem({
    THREE: { BufferGeometry, BufferAttribute, PointsMaterial, Points, AdditiveBlending: 'add' },
    group,
    texture: {},
    particleCount: 1,
    initialPositions: new Float32Array([0, 0, 0]),
    poolSize: 2,
    getLifetime: () => 1,
    random: () => 0.5,
  });

  trails.update({
    deltaTime: 0.1,
    particlePositions: new Float32Array([0.1, 0, 0]),
    particleColors: new Float32Array([0.8, 0.6, 0.4]),
    visibility: new Float32Array([1]),
  });
  const { position, color } = trails.points.geometry.attributes;
  expect(position.array[0]).toBeGreaterThan(0.1);
  expect(color.array[0]).toBeGreaterThan(0);
  expect(position.needsUpdate).toBe(true);
  expect(color.needsUpdate).toBe(true);

  trails.update({
    deltaTime: 2,
    particlePositions: new Float32Array([0.1, 0, 0]),
    particleColors: new Float32Array([0.8, 0.6, 0.4]),
    visibility: new Float32Array([1]),
  });
  expect(position.array[0]).toBe(0);
  expect(color.array[0]).toBe(0);
});

test('scene runtime owns renderer sizing, rendering, and pixel reads', async () => {
  const calls = [];
  class Scene {
    add(value) { this.child = value; }
  }
  class Camera {
    constructor(fov, aspect, near, far) {
      Object.assign(this, { fov, aspect, near, far, position: {} });
    }
    updateProjectionMatrix() { calls.push('projection'); }
    setViewOffset(...args) { calls.push(['offset', ...args]); }
    clearViewOffset() { calls.push('clear-offset'); }
  }
  class Renderer {
    constructor(options) {
      this.options = options;
      this.domElement = { style: {} };
    }
    setClearColor(...args) { calls.push(['clear', ...args]); }
    setSize(width, height) {
      this.domElement.width = width;
      this.domElement.height = height;
      calls.push(['size', width, height]);
    }
    setPixelRatio(value) { this.ratio = value; }
    getPixelRatio() { return this.ratio; }
    render(scene, camera) { calls.push(['render', scene, camera]); }
    setRenderTarget(target) { calls.push(['target', target]); }
    readRenderTargetPixels(...args) {
      calls.push(['read', ...args]);
      if (this.failReads) throw new Error('read failed');
    }
  }
  class Group {}
  const mount = { appendChild(value) { this.child = value; } };
  const { createSceneRuntime } = await importAppModule('scene', 'scene-runtime.js');
  const runtime = createSceneRuntime({
    THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer, Group },
    mount,
    width: 800,
    height: 400,
    pixelRatio: 3,
  });

  expect(runtime.aspect).toBe(2);
  expect(runtime.pixelRatio).toBe(2);
  expect(mount.child).toBe(runtime.canvas);
  expect(runtime.scene.child).toBe(runtime.group);

  runtime.resize(600, 300, 120);
  expect(runtime.canvas.style.left).toBe('120px');
  expect(runtime.camera.aspect).toBe(2);
  runtime.setVerticalViewOffset(600, 300, 100);
  runtime.setVerticalViewOffset(600, 300, 0);
  runtime.render();

  const target = { id: 'thumbnail' };
  const pixels = new Uint8Array(16);
  runtime.readPixels(target, 2, 2, pixels);
  expect(calls).toContainEqual(['offset', 600, 400, 0, 100, 600, 300]);
  expect(calls).toContain('clear-offset');
  expect(calls).toContainEqual(['read', target, 0, 0, 2, 2, pixels]);
  expect(calls.at(-1)).toEqual(['target', null]);

  runtime.renderer.failReads = true;
  expect(() => runtime.readPixels(target, 2, 2, pixels)).toThrow('read failed');
  expect(calls.at(-1)).toEqual(['target', null]);
});

test('sphere drag controller owns pointer rotation and inertial decay', async () => {
  const {
    createSphereDragController, createSphereRotationController,
  } = await importAppModule('scene', 'sphere-drag.js');
  class FakeTarget {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }
    emit(type, event = {}) { this.listeners.get(type)?.(event); }
  }
  const canvas = new FakeTarget();
  const windowLike = new FakeTarget();
  const classes = new Set();
  const body = { classList: {
    add: value => classes.add(value),
    remove: value => classes.delete(value),
  } };
  const controller = createSphereDragController({ canvas, windowLike, body });

  controller.connect();
  canvas.emit('mousedown', { clientX: 0, clientY: 0 });
  windowLike.emit('mousemove', { clientX: 10, clientY: 5 });
  expect(classes.has('dragging')).toBe(true);
  expect(controller.step({ autoSpeed: 1, suppressAutoSpeed: false })).toEqual({ x: 0.03, y: 0.06 });

  windowLike.emit('mouseup');
  const inertial = controller.step({ autoSpeed: 0.01, suppressAutoSpeed: false });
  expect(inertial.x).toBeCloseTo(0.0576);
  expect(inertial.y).toBeCloseTo(0.1252);
  expect(classes.has('dragging')).toBe(false);

  controller.disconnect();
  expect(canvas.listeners.size).toBe(0);
  expect(windowLike.listeners.size).toBe(0);

  const rotationCalls = [];
  class FakeVector3 {
    constructor(x, y, z) { Object.assign(this, { x, y, z }); }
    normalize() { rotationCalls.push(['normalize', this.x, this.y, this.z]); return this; }
  }
  class FakeQuaternion {
    setFromAxisAngle(axis, angle) {
      rotationCalls.push(['axis-angle', axis, angle]);
      return this;
    }
  }
  const dragSteps = [];
  const group = {
    rotation: { set: (...values) => rotationCalls.push(['euler', ...values]) },
    quaternion: { premultiply: value => rotationCalls.push(['premultiply', value]) },
  };
  const rotation = createSphereRotationController({
    THREE: { Vector3: FakeVector3, Quaternion: FakeQuaternion },
    group,
    dragController: {
      step: state => { dragSteps.push(state); return { x: 0.2, y: -0.3 }; },
    },
  });
  const composed = rotation.step({
    deltaTime: 0.5, autoSpeed: 0.01, enabled: true, rotationSpeed: 0.2,
  });
  expect(dragSteps).toEqual([{ autoSpeed: 0.01, suppressAutoSpeed: true }]);
  expect(rotationCalls).toContainEqual(['euler', 0.2, -0.3, 0]);
  expect(rotationCalls.find(call => call[0] === 'axis-angle')[2]).toBeCloseTo(0.1);
  expect(composed.angle).toBeCloseTo(0.1);
});

test('sphere presentation updates live cloud and visible core from one snapshot', async () => {
  const { updateSpherePresentation } = await importAppModule('scene', 'sphere-presentation.js');
  const cloudCalls = [];
  const coreCalls = [];
  const cycleSegment = { a: 'red', b: 'blue', t: 0.75 };
  const result = updateSpherePresentation({
    cloud: { update: (...args) => cloudCalls.push(args) },
    core: {
      sprite: { visible: true },
      setCycleBlend: value => coreCalls.push(['blend', value]),
      update: (...args) => coreCalls.push(['update', ...args]),
    },
    group: { name: 'sphere' }, time: 2, radius: 1.5,
    sphere: { scale: 2, innerScale: 0.8 }, cycleOn: true,
    cycleWeights: { a: 'red', b: 'blue', wa: 0.25, wb: 0.75 },
    cycleSegment, activeEmotion: 'blue', params: { size: 4 }, animScrubbing: false,
  });
  expect(result).toEqual({
    redMix: 0.25, purpleMix: 0, blueMix: 0.75, yellowMix: 0, worldRadius: 3,
  });
  expect(cloudCalls[0].slice(1)).toEqual([2, 3, 2, 0.25, 0, 0.75, 0, false]);
  expect(coreCalls[0]).toEqual(['blend', cycleSegment]);
  expect(coreCalls[1][2].params).toEqual({ size: 4, emotion: 'blue' });
  expect(coreCalls[1][2].scale).toBeCloseTo(1.62);
});

test('layer reset helpers zero, resize, restore, and respawn scene layers', async () => {
  const {
    respawnFireflyLayers,
    restoreDefaultLayerConfiguration,
    zeroParticleLayers,
  } = await importAppModule('scene', 'layer-reset.js');
  const calls = [];
  const makeInner = () => ({ field: { setParams: patch => calls.push(['inner', patch]) } });
  const makeFirefly = name => ({
    name,
    overrides: {},
    anim: false,
    setParams: patch => calls.push(['firefly', name, patch]),
    respawn: () => calls.push(['respawn', name]),
  });
  const innerLayers = [makeInner(), makeInner()];
  const fireflyLayers = [makeFirefly('one'), makeFirefly('extra'), makeFirefly('stale')];

  zeroParticleLayers({ innerLayers, fireflyLayers });
  expect(calls.filter(call => call.at(-1)?.count === 0)).toHaveLength(5);
  calls.length = 0;

  const disposed = [];
  const overrides = [{ calm: '#111111' }, { calm: '#222222' }];
  restoreDefaultLayerConfiguration({
    innerLayers,
    fireflyLayers,
    innerDefaults: { count: 10, breathAmp: 1 },
    innerPresets: [{ count: 20 }, { count: 30 }],
    fireflyDefaults: { count: 40, radius: 1 },
    fireflyPresets: [{ count: 50 }, { radius: 2 }],
    fireflyOverrides: overrides,
    createFireflyLayer: () => makeFirefly('created'),
    disposeFireflyLayer: layer => disposed.push(layer.name),
  });
  expect(disposed).toEqual(['stale']);
  expect(fireflyLayers).toHaveLength(2);
  expect(fireflyLayers.every(layer => layer.anim)).toBe(true);
  expect(fireflyLayers[0].overrides).toEqual(overrides[0]);
  expect(fireflyLayers[0].overrides).not.toBe(overrides[0]);
  expect(calls).toContainEqual(['inner', expect.objectContaining({ count: 20, breathAmp: 0 })]);
  expect(calls).toContainEqual(['firefly', 'one', { count: 50, radius: 1 }]);

  calls.length = 0;
  respawnFireflyLayers(fireflyLayers);
  expect(calls).toEqual([['respawn', 'one'], ['respawn', 'extra']]);
});

test('firefly layer collection enforces capacity, splitting, and disposal', async () => {
  const { createFireflyLayerCollection } = await importAppModule('scene', 'firefly-layer-collection.js');
  const disposed = [];
  let nextId = 0;
  const factory = {
    maxLayers: 3,
    create: (params = {}, overrides = {}) => {
      const color = { value: `color-${nextId}` };
      return {
        id: nextId++,
        params: { count: 10, ...params },
        overrides,
        anim: true,
        color: () => ({
          value: color.value,
          copy(source) { color.value = source.value; },
        }),
        setParams(patch) { Object.assign(this.params, patch); },
      };
    },
    dispose: layer => disposed.push(layer.id),
  };
  const collection = createFireflyLayerCollection({
    factory,
    presets: [{ count: 9 }],
    overrides: [{ calm: '#fff' }],
  });

  expect(collection.layers[0].overrides).toEqual({ calm: '#fff' });
  expect(collection.split(0)).toBe(1);
  expect(collection.layers.map(layer => layer.params.count)).toEqual([5, 4]);
  expect(collection.add({ count: 3 }).params.count).toBe(3);
  expect(collection.add()).toBeNull();
  expect(collection.remove(1)).toBe(1);
  expect(disposed).toEqual([1]);
  expect(collection.removeLast()).toBe(true);
  expect(collection.removeLast()).toBe(false);
  expect(disposed).toEqual([1, 2]);
});
