const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Preset restoration, public runtime, readiness, undo, and bootstraps.

test('preset restore context synchronizes lazy renderer state and compatibility inputs', async () => {
  const { createPresetRestoreContextFactory } = await importAppModule('presets', 'preset-restore-context.js');
  const elements = {
    'glow-color': {},
    'glow-opacity': {},
    'anim-loop-chk': {},
  };
  const settings = { glowColor: '#ffffff', glowOpacity: 0 };
  const playbackState = { loop: true };
  const shellPoints = { visible: true };
  const calls = [];
  const factory = createPresetRestoreContextFactory({
    documentLike: { getElementById: id => elements[id] ?? null },
    getInnerLayersReady: () => true,
    getInnerLayers: () => ['inner'],
    getFireflyLayers: () => ['firefly'],
    addFireflyLayer: () => 'added',
    removeLastFireflyLayer: () => true,
    sceneTimeline: ['scene'],
    classicState: { scale: 1 },
    hexToRgb: value => value,
    applyMode: value => calls.push(['mode', value]),
    switchEmotion: value => calls.push(['emotion', value]),
    sceneSettings: settings,
    cloud: {
      setUserTint: (...args) => calls.push(['tint', ...args]),
      setVisible: value => calls.push(['glow-visible', value]),
    },
    shellPoints,
    playbackState,
    setSceneAnimation: value => calls.push(['scene-animation', value]),
    sceneSettingsController: {
      setPrimaryColor: value => calls.push(['primary', value]),
      setSecondaryColor: value => calls.push(['secondary', value]),
      setGradientAmount: value => calls.push(['gradient', value]),
      setRotationEnabled: value => calls.push(['rotation', value]),
      setRotationSpeed: value => calls.push(['rotation-speed', value]),
    },
  });
  const context = factory({
    setCoreParameter: value => calls.push(['core', value]),
    setPresetName: value => calls.push(['name', value]),
    setToggle: (id, value, apply) => { calls.push(['toggle', id, value]); apply(value); },
  });

  expect(context).toMatchObject({
    innerLayersReady: true,
    innerLayers: ['inner'],
    fireflyLayers: ['firefly'],
    sceneTimeline: ['scene'],
  });
  context.setGlowColor('#123456');
  context.setGlowOpacity(0.4);
  context.setLoop(false);
  context.setGlowVisible(false);
  context.setFirefliesVisible(false);
  expect(settings).toMatchObject({ glowColor: '#123456', glowOpacity: 0.4 });
  expect(elements['glow-color'].value).toBe('#123456');
  expect(elements['glow-opacity'].value).toBe(0.4);
  expect(elements['anim-loop-chk'].checked).toBe(false);
  expect(playbackState.loop).toBe(false);
  expect(shellPoints.visible).toBe(false);
  expect(calls).toContainEqual(['tint', '#123456', null]);
  expect(calls).toContainEqual(['tint', null, 0.4]);
});

test('preset restorer grows and shrinks layers while applying exact document state', async () => {
  const { parsePresetDocument } = await importAppModule('presets', 'preset-format.js');
  const { restoreParsedPreset } = await importAppModule('presets', 'preset-restorer.js');
  const calls = [];
  const makeLayer = name => ({
    name,
    params: { count: 1 },
    overrides: { stale: '#ffffff' },
    timeline: [{ duration: 99 }],
    idle: { count: 1 },
    setParams(patch) { Object.assign(this.params, patch); },
  });
  const innerLayers = [{
    overrides: { stale: [1, 1, 1] },
    field: { params: {}, setParams(patch) { Object.assign(this.params, patch); } },
  }];
  const fireflyLayers = [makeLayer('stale')];
  const sceneTimeline = [{ duration: 99 }];
  const classicState = { life: 1 };
  let sceneAnimation = false;
  const adapters = {
    innerLayersReady: true,
    innerLayers,
    fireflyLayers,
    sceneTimeline,
    classicState,
    hexToRgb: value => `rgb:${value}`,
    addFireflyLayer: () => { const layer = makeLayer(null); fireflyLayers.push(layer); return layer; },
    removeLastFireflyLayer: () => { fireflyLayers.pop(); return true; },
    setCoreParameter: (key, value) => calls.push(['core', key, value]),
    applyMode: value => calls.push(['mode', value]),
    switchEmotion: value => calls.push(['emotion', value]),
    setPresetName: value => calls.push(['preset-name', value]),
    setGlowColor: value => calls.push(['glow-color', value]),
    setBackgroundColor: value => calls.push(['background', value]),
    setSecondaryBackgroundColor: value => calls.push(['background-2', value]),
    setSceneAnimation: value => { sceneAnimation = value; },
    setLoop: value => calls.push(['loop', value]),
    setGlowVisible: value => calls.push(['glow', value]),
    setFirefliesVisible: value => calls.push(['fireflies', value]),
    setGlowOpacity: value => calls.push(['glow-opacity', value]),
    setGradientAmount: value => calls.push(['gradient', value]),
    setRotationEnabled: value => calls.push(['rotate', value]),
    setRotationSpeed: value => calls.push(['rotate-speed', value]),
  };
  const documentText = `
Layer 1
count 7
@calm #101010
Firefly Layer 1
name Base
count 10
@calm #111111
Firefly Layer 2
name Accent
count 20
Anim Layer 1
animate 0
Phase 1 @ 2
name Intro
count 5
colour #abcdef
Anim Scene
animate 1
Phase 1 @ 3
life 4
glowopacity 0
bggradient 0
View
emotion calm
mode fireflies
loop 0
glow 0
fireflies 1
glowcolor #222222
glowopacity 0
bgcolor #000000
bgcolor2 #333333
bggradient 0
rotate 1
rotatespeed -0.1
presetname Restored Look`;
  restoreParsedPreset({ ...adapters, parsedPreset: parsePresetDocument(documentText) });

  expect(fireflyLayers).toHaveLength(2);
  expect(fireflyLayers[0]).toMatchObject({
    name: 'Base', params: { count: 10 }, overrides: { calm: '#111111' }, anim: false,
  });
  expect(fireflyLayers[1]).toMatchObject({ name: 'Accent', params: { count: 20 } });
  expect(fireflyLayers[0].timeline[0]).toMatchObject({
    duration: 2, name: 'Intro', snapshot: { params: { count: 5 }, colour: '#abcdef' },
  });
  expect(fireflyLayers[0].idle).toEqual({ count: 10 });
  expect(innerLayers[0].overrides).toEqual({ calm: 'rgb:#101010' });
  expect(sceneAnimation).toBe(true);
  expect(sceneTimeline[0].snapshot).toEqual({
    classic: { life: 4 }, glowOpacity: 0, bgGradientAmount: 0,
  });
  expect(calls).toContainEqual(['loop', false]);
  expect(calls).toContainEqual(['glow-opacity', 0]);
  expect(calls).toContainEqual(['preset-name', 'Restored Look']);

  restoreParsedPreset({
    ...adapters,
    parsedPreset: parsePresetDocument('Firefly Layer 1\ncount 3'),
  });
  expect(fireflyLayers).toHaveLength(1);
  expect(fireflyLayers[0].params.count).toBe(3);
});

test('preset document controller restores generated inputs and document policy', async () => {
  const { createPresetDocumentController } = await importAppModule('presets', 'preset-document-controller.js');
  const nameInput = { value: 'Stale name' };
  const coreInput = {
    value: '',
    dispatchEvent: event => { coreInput.lastEvent = event; },
  };
  const coreRow = {
    querySelector: selector => selector === 'span'
      ? { textContent: 'radius' }
      : coreInput,
  };
  const documentLike = {
    getElementById: id => id === 'rp-preset-name' ? nameInput : null,
    querySelectorAll: selector => selector === '#params-controls .row' ? [coreRow] : [],
  };
  const calls = [];
  const controller = createPresetDocumentController({
    documentLike,
    collectSerializationState: () => ({}),
    clearThumbnails: () => calls.push('clear-thumbnails'),
    createRestoreContext: ({ setCoreParameter }) => ({
      innerLayersReady: false,
      innerLayers: [],
      fireflyLayers: [],
      addFireflyLayer: () => false,
      removeLastFireflyLayer: () => false,
      sceneTimeline: [],
      classicState: {},
      hexToRgb: value => value,
      setCoreParameter,
    }),
    syncAfterRestore: () => calls.push('sync'),
    isHistoryRestoring: () => false,
    resetHistoryAfterLoad: () => calls.push('reset-history'),
    setPressed: () => {},
  });

  controller.restore('Core Particles\nradius 2.5');
  expect(nameInput.value).toBe('');
  expect(coreInput.value).toBe(2.5);
  expect(coreInput.lastEvent.bubbles).toBe(true);
  expect(calls).toEqual(['clear-thumbnails', 'sync', 'reset-history']);
});

test('live preset state collector derives slider precision and view toggles from DOM', async () => {
  const {
    readSliderDefinitions,
    serializeLivePreset,
  } = await importAppModule('presets', 'preset-state.js');
  const makeRow = (key, step) => ({
    querySelector: selector => selector === 'span'
      ? { textContent: key }
      : { step: String(step) },
  });
  const fireflyRows = [makeRow('colour', 1), makeRow('count', 5), makeRow('radius', 0.05)];
  const classicRows = [makeRow('life', 0.1)];
  const elements = {
    'rp-preset-name': { value: '  Collected Look  ' },
    'toggle-glow': { classList: { contains: name => name === 'active' } },
    'toggle-fireflies': { classList: { contains: () => false } },
  };
  const documentLike = {
    querySelectorAll: selector => selector.startsWith('#firefly') ? fireflyRows : classicRows,
    getElementById: id => elements[id],
  };
  expect(readSliderDefinitions(documentLike, '#firefly-field-controls .row', {
    excludeColour: true,
  })).toEqual([['count', 5], ['radius', 0.05]]);

  const text = serializeLivePreset({
    documentLike,
    fireflyLayers: [{
      name: 'Base', params: { count: 25, radius: 1.234 }, overrides: {},
      anim: true, timeline: [],
    }],
    classic: { life: 4.567 },
    sceneTimeline: [],
    sceneAnimation: true,
    viewState: {
      emotion: 'calm', mode: 'circles', loop: true,
      glowColor: '#ffffff', glowOpacity: 0,
      bgColor: '#000000', bgColor2: '#111111', bgGradientAmount: 0,
      rotate: false, rotateSpeed: 0.1,
    },
  });
  expect(text).toContain('count 25');
  expect(text).toContain('radius 1.23');
  expect(text).toContain('life 4.57');
  expect(text).toContain('glow 1');
  expect(text).toContain('fireflies 0');
  expect(text).toContain('presetname Collected Look');
});

test('emotion runtime API validates aliases and routes every preset through readiness', async () => {
  const {
    createEmotionSphereApi,
    DEFAULT_PRESET_FILES,
  } = await importAppModule('runtime', 'emotion-api.js');
  const calls = [];
  const api = createEmotionSphereApi({
    fetchLike: file => {
      calls.push(['fetch', file]);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(`preset:${file}`) });
    },
    applyPresetWhenReady: text => { calls.push(['apply', text]); return `applied:${text}`; },
  });
  expect(api.emotions).toEqual(Object.keys(DEFAULT_PRESET_FILES));
  await expect(api.play('HAPPY')).resolves.toBe('applied:preset:presets/firefly-warm.txt');
  expect(calls).toEqual([
    ['fetch', 'presets/firefly-warm.txt'],
    ['apply', 'preset:presets/firefly-warm.txt'],
  ]);
  await expect(api.applyPreset('custom')).resolves.toBe('applied:custom');
  await expect(api.play('unknown')).rejects.toThrow('unknown emotion: unknown');

  const failing = createEmotionSphereApi({
    presetFiles: { calm: 'missing.txt' },
    fetchLike: () => Promise.resolve({ ok: false }),
    applyPresetWhenReady: () => { throw new Error('must not apply'); },
  });
  await expect(failing.play('calm')).rejects.toThrow('preset fetch failed: missing.txt');
});

test('preset runtime bootstrap publishes the API after registering document adapters', async () => {
  const { initializePresetRuntime } = await importAppModule('bootstrap', 'preset-runtime.js');
  const calls = [];
  const windowLike = {
    addEventListener: type => calls.push(['listen', type]),
    location: { search: '' },
  };
  const readiness = {
    whenEditorReady: Promise.resolve(),
    registerDocumentAdapter: adapter => { readiness.adapter = adapter; calls.push('register'); },
    captureDefault: () => calls.push('capture'),
  };
  const result = await initializePresetRuntime({
    environment: {
      documentLike: {
        body: { classList: { add() {} } },
        getElementById: () => null,
        querySelectorAll: () => [],
      },
      windowLike,
      navigatorLike: { clipboard: null },
      locationLike: { search: '', href: 'http://localhost/' },
      fetchLike: async () => ({ ok: true, text: async () => 'preset' }),
    },
    readiness,
    documentState: {
      getInnerLayersReady: () => true,
      getInnerLayers: () => [],
      getFireflyLayers: () => [],
      sceneTimeline: [],
      classicState: {},
      sceneSettings: {},
      setSceneAnimation() {},
      collectSerializationState: () => ({
        fireflyLayers: [], classic: {}, sceneTimeline: [], sceneAnimation: true, viewState: {},
      }),
    },
    restoreAdapters: {
      addFireflyLayer() {}, removeLastFireflyLayer() {}, hexToRgb() {}, applyMode() {},
      switchEmotion() {}, cloud: {}, shellPoints: {}, sceneSettingsController: {},
    },
    playback: { state: {}, getSequence: () => [], getDuration: () => 0 },
    history: { isRestoring: () => false, resetAfterLoad() {} },
    syncAfterRestore() {}, clearThumbnails() {},
    emotionControls: {}, setDotActive() {}, setPressed() {},
  });

  expect(readiness.adapter).toMatchObject({
    serialize: expect.any(Function),
    restore: expect.any(Function),
  });
  expect(windowLike.emotionSphere).toBe(result.emotionApi);
  expect(calls).toEqual(['register', 'capture', ['listen', 'message']]);
});

test('core runtime bootstrap orders attachment, mode restoration, and preset startup', async () => {
  const { initializeCoreRuntime } = await importAppModule('bootstrap', 'core-runtime.js');
  const calls = [];
  const controls = Object.fromEntries(['params-controls', 'params-panel', 'params-toggle', 'reset-core-params']
    .map(id => [id, {
      classList: { toggle: value => calls.push(['panel', value]) },
      addEventListener: (type, listener) => { if (id === 'reset-core-params') controls.reset = listener; },
    }]));
  const core = {
    sprite: { visible: true },
    setPrototype: prototype => calls.push(['prototype', prototype.count]),
  };
  let publishedControls;
  const result = await initializeCoreRuntime({
    THREE: {}, group: {}, innerLayers: ['legacy'],
    documentLike: {
      getElementById: id => controls[id] ?? null,
      querySelectorAll: () => [],
    },
    emotionControls: { setPrototypeActive: name => calls.push(['active', name]) },
    getSphereMode: () => 'circles',
    applySphereMode: mode => calls.push(['mode', mode]),
    onCoreReady: value => calls.push(['core-ready', value === core]),
    onPrototypeControlsReady: value => { publishedControls = value; calls.push('controls-ready'); },
    presetRuntimeOptions: { marker: true },
    loadCore: async () => ({
      attachSphereCore: options => { calls.push(['attach', options.innerLayers]); return core; },
    }),
    initializePresetRuntimeFn: async options => {
      calls.push(['preset-runtime', options.marker]);
      return 'runtime';
    },
  });

  expect(core.sprite.visible).toBe(false);
  expect(publishedControls.activeName).toBe('core');
  expect(result).toMatchObject({ core, prototypeControls: publishedControls, presetRuntime: 'runtime' });
  expect(calls).toEqual([
    ['attach', ['legacy']], ['core-ready', true], 'controls-ready', ['mode', 'circles'],
    ['active', 'core'], ['prototype', 15000], ['preset-runtime', true],
  ]);
});

test('scene render bootstrap composes runtime services and starts one ordered frame', async () => {
  const { initializeSceneRenderRuntime } = await importAppModule('bootstrap', 'scene-render-runtime.js');
  const calls = [];
  const trails = {
    points: 'trail-points',
    resetPrevious: index => calls.push(['trail-reset', index]),
  };
  const spawner = { reset() {} };
  const viewport = { layout: () => {}, connect: () => calls.push('viewport-connect') };
  const services = {
    createParticleTrailSystem: options => { calls.push(['trails', options.particleCount]); return trails; },
    createParticleSpawner: options => {
      calls.push(['spawner', options.particleCount]);
      options.onSpawn(1, 3);
      return spawner;
    },
    createParticleColorRenderer: () => ({ update: time => calls.push(['color', time]) }),
    createSphereDragController: () => ({ connect: () => calls.push('drag-connect') }),
    createSphereRotationController: () => 'rotation',
    createSceneFrameRunner: options => {
      calls.push(['frame-runner', options.particleTrails === trails]);
      return { run: time => calls.push(['frame', time]) };
    },
    createEditorViewport: () => viewport,
  };
  const geometry = {
    attributes: { aSize: {}, color: {} },
    getAttribute: name => ({ array: [name] }),
  };
  const runtime = initializeSceneRenderRuntime({
    THREE: { Clock: class { getElapsedTime() { return 2; } } },
    documentLike: { body: {} },
    windowLike: { requestAnimationFrame: () => calls.push('raf') },
    group: {}, sceneRuntime: { canvas: {}, render() {} }, cloud: {}, getCore: () => null,
    classic: {},
    shell: { count: 1, origin: [], phases: [], colors: [], geometry },
    inner: {
      count: 2, initialPositions: [], origin: [], phases: [], colors: [], geometry,
      sequenceTint: [], axes: [], births: [], visibility: [],
    },
    materials: {}, trailTexture: {}, getTrailLifetime: () => 1, getSpawnInterval: () => 1,
    onSpawn: (index, time, particleTrails) => {
      calls.push(['spawn', index, time]);
      particleTrails.resetPrevious(index);
    },
    getColorState: () => ({}), getFrameState: () => ({}),
    tickCycle: () => calls.push('cycle'), updateInnerLayers() {}, onSceneResize() {}, services,
  });

  expect(runtime).toMatchObject({
    particleSpawner: spawner,
    particleTrails: trails,
    trailPoints: 'trail-points',
    viewport,
  });
  expect(calls).toEqual([
    ['trails', 2], ['spawner', 2], ['spawn', 1, 3], ['trail-reset', 1],
    ['color', 0], 'drag-connect', ['frame-runner', true], 'raf', 'cycle',
    ['frame', 2], 'viewport-connect',
  ]);
});

test('application state bootstrap returns isolated canonical subsystem state', async () => {
  const { createApplicationState } = await importAppModule('bootstrap', 'application-state.js');
  const first = createApplicationState();
  const second = createApplicationState();

  expect(first).toMatchObject({
    readiness: expect.any(Object),
    scene: expect.any(Object),
    playback: expect.any(Object),
    emotion: expect.any(Object),
    classic: expect.any(Object),
  });
  first.scene.glowOpacity = 0.75;
  first.playback.time = 5;
  first.emotion.select('yellow');
  first.classic.interval = 9;
  first.sceneTimeline.push({ duration: 5 });
  expect(second.scene.glowOpacity).toBe(0);
  expect(second.playback.time).toBe(0);
  expect(second.emotion.activeEmotion).toBe('red');
  expect(second.classic.interval).toBe(0.65);
  expect(second.sceneTimeline).toEqual([]);
});

test('application readiness orders editor and complete-document boot work', async () => {
  const { createApplicationReadiness } = await importAppModule('runtime', 'app-readiness.js');
  const readiness = createApplicationReadiness();
  const calls = [];
  readiness.onEditorReady(() => calls.push('editor'));
  readiness.onReady(() => calls.push('complete'));
  expect(readiness.ready).toBe(false);
  expect(readiness.serialize(null)).toBeNull();
  expect(readiness.captureDefault()).toBe(false);

  let captures = 0;
  readiness.registerDefaultCapture(() => { captures += 1; return true; });
  readiness.markEditorReady();
  await readiness.whenEditorReady;
  expect(calls).toEqual(['editor']);
  expect(readiness.captureDefault()).toBe(true);

  readiness.registerDocumentAdapter({
    serialize: () => 'document text',
    restore: text => calls.push(`restore:${text}`),
  });
  expect(readiness.ready).toBe(true);
  expect(calls).toEqual(['editor', 'complete']);
  expect(readiness.serialize()).toBe('document text');
  readiness.restore('saved');
  expect(calls.at(-1)).toBe('restore:saved');
  expect(typeof readiness.getRestore()).toBe('function');
  expect(captures).toBe(1);

  // Idempotent readiness signals prevent duplicate setup when two callers
  // observe the same dynamic import completing.
  readiness.markEditorReady();
  expect(calls.filter(call => call === 'editor')).toHaveLength(1);
});

test('kiosk runtime keeps query precedence, dot actions, and host messages together', async () => {
  const {
    createKioskRuntimeController,
    parseKioskRuntimeQuery,
  } = await importAppModule('runtime', 'kiosk-runtime.js');
  expect(parseKioskRuntimeQuery('?embed=1&emotion=calm&preset=shared')).toEqual({
    kiosk: true,
    preset: 'shared',
    emotion: null,
  });
  expect(parseKioskRuntimeQuery('?emotion=warm')).toEqual({
    kiosk: false,
    preset: null,
    emotion: 'warm',
  });

  const calls = [];
  const listeners = new Map();
  const actions = new Map();
  const classes = new Set();
  const controller = createKioskRuntimeController({
    windowLike: {
      location: { search: '?mode=kiosk&emotion=calm' },
      addEventListener: (type, listener) => listeners.set(type, listener),
    },
    body: { classList: { add: value => classes.add(value) } },
    emotionControls: { setEmotionAction: (id, action) => actions.set(id, action) },
    emotionApi: { play: emotion => { calls.push(['play', emotion]); return Promise.resolve(); } },
    applyPresetWhenReady: text => calls.push(['preset', text]),
    decodePreset: value => `decoded:${value}`,
    setDotActive: id => calls.push(['dot', id]),
  });

  const options = controller.configure();
  await controller.applyInitialSelection(options);
  expect(classes).toContain('kiosk');
  expect(actions.size).toBe(4);
  expect(calls).toEqual([['dot', 'd-purple'], ['play', 'calm']]);

  await actions.get('d-yellow')();
  controller.connectMessages();
  controller.connectMessages(); // connecting twice must not duplicate listeners
  listeners.get('message')({ data: { type: 'emotion', value: 'anger' } });
  expect(calls.slice(-4)).toEqual([
    ['dot', 'd-yellow'], ['play', 'warm'],
    ['dot', 'd-red'], ['play', 'anger'],
  ]);

  const shared = controller.configure('?mode=kiosk&emotion=sad&preset=payload');
  await controller.applyInitialSelection(shared);
  expect(calls.at(-1)).toEqual(['preset', 'decoded:payload']);
  expect(classes).toContain('watch');
});

test('undo history coalesces edit bursts and preserves native text undo', async () => {
  const {
    createUndoHistory,
    isNativeTextUndoTarget,
  } = await importAppModule('state', 'undo-history.js');
  expect(isNativeTextUndoTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
  expect(isNativeTextUndoTarget({ tagName: 'INPUT', type: 'range' })).toBe(false);
  expect(isNativeTextUndoTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);

  let state = 'initial';
  let isReady = false;
  let scheduled;
  let blurred = 0;
  const availability = [];
  const history = createUndoHistory({
    capture: () => state,
    restore: () => snapshot => { state = snapshot; },
    ready: () => isReady,
    blurActiveElement: () => { blurred += 1; },
    onAvailabilityChange: available => availability.push(available),
    schedule: callback => { scheduled = callback; return callback; },
    cancel: () => {},
    maxEntries: 2,
  });

  history.initializeIfReady();
  isReady = true;
  history.initializeIfReady();
  state = 'during first burst';
  history.markDirty();
  state = 'same burst';
  history.markDirty();
  expect(history.size).toBe(1);
  scheduled();

  state = 'second edit';
  history.markDirty();
  expect(history.size).toBe(2);
  expect(history.undo()).toBe(true);
  expect(state).toBe('same burst');
  expect(blurred).toBe(1);
  expect(availability).toEqual([true, true, true]);

  history.resetAfterDocumentLoad();
  expect(history.size).toBe(0);
  expect(availability.at(-1)).toBe(false);
  expect(history.undo()).toBe(false);
});

test('scene settings provide one mutable state object and isolated snapshots', async () => {
  const { createSceneSettings } = await importAppModule('state', 'scene-settings.js');
  const settings = createSceneSettings({ glowOpacity: 0.4, rotationEnabled: true });
  expect(settings).toMatchObject({
    glowColor: '#ffffff',
    glowOpacity: 0.4,
    backgroundColor: '#000000',
    secondaryBackgroundColor: '#c9d0d6',
    gradientAmount: 0,
    rotationEnabled: true,
    rotationSpeed: 0.1,
  });
  const snapshot = settings.snapshot();
  settings.glowOpacity = 0.8;
  settings.backgroundColor = '#123456';
  expect(snapshot.glowOpacity).toBe(0.4);
  expect(snapshot.backgroundColor).toBe('#000000');
  expect(Object.keys(settings)).not.toContain('snapshot');
});
