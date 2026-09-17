const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Current controls, panel shell, viewport, gallery, and diagnostics.

test('layer controls synchronize navigation UI without overwriting an active rename', async () => {
  const { createLayerControls } = await importAppModule('ui/controls', 'layer-controls.js');
  class FakeControl {
    constructor() {
      this.listeners = new Map();
      this.value = '';
      this.disabled = false;
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({}); }
  }
  const ids = [
    'rp-layer-eyebrow', 'rp-layer-name', 'rp-layer-paste', 'rp-layer-prev',
    'rp-layer-next', 'rp-layer-add', 'rp-layer-remove', 'rp-layer-clear',
    'rp-layer-zero-all', 'rp-layer-copy',
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeControl()]));
  const documentLike = {
    activeElement: null,
    getElementById: id => elements[id],
  };
  const calls = [];
  const controls = createLayerControls({
    documentLike,
    getViewModel: () => ({ activeIndex: 1, layerCount: 3, name: 'Middle' }),
    onPrevious: () => calls.push('previous'),
    onNext: () => calls.push('next'),
    onRename: name => calls.push(['rename', name]),
    onAdd: () => calls.push('add'),
    onRemove: () => calls.push('remove'),
    onClear: () => calls.push('clear'),
    onClearAll: () => calls.push('clear-all'),
    onCopy: () => calls.push('copy'),
    onPaste: () => calls.push('paste'),
  });

  controls.sync();
  expect(elements['rp-layer-eyebrow'].textContent).toBe('Layer 2/3');
  expect(elements['rp-layer-name'].value).toBe('Middle');
  expect(elements['rp-layer-name'].placeholder).toBe('Layer 2');
  documentLike.activeElement = elements['rp-layer-name'];
  elements['rp-layer-name'].value = '  Draft name  ';
  controls.sync();
  expect(elements['rp-layer-name'].value).toBe('  Draft name  ');
  elements['rp-layer-name'].emit('input');
  elements['rp-layer-next'].emit('click');
  elements['rp-layer-copy'].emit('click');
  expect(calls).toEqual([['rename', 'Draft name'], 'next', 'copy']);
  expect(elements['rp-layer-paste'].disabled).toBe(false);
  controls.setPasteEnabled(false);
  expect(elements['rp-layer-paste'].disabled).toBe(true);
});

test('rotation controls present global state and preserve a focused speed input', async () => {
  const { createRotationControls } = await importAppModule('ui/controls', 'rotation-controls.js');
  class FakeControl {
    constructor() {
      this.listeners = new Map();
      this.classes = new Set();
      this.attributes = new Map();
      this.value = '';
      this.classList = {
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
        contains: name => this.classes.has(name),
      };
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({}); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
  }
  const ids = ['rp-rotate-toggle', 'rp-rotate-speed', 'rp-rotate-speed-val', 'rp-rotate-speed-row'];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeControl()]));
  const documentLike = { activeElement: null, getElementById: id => elements[id] };
  const state = { enabled: false, speed: 0.1 };
  let changes = 0;
  const controls = createRotationControls({
    documentLike,
    getState: () => state,
    setEnabled: value => { state.enabled = value; },
    setSpeed: value => { state.speed = value; },
    onChange: () => { changes += 1; },
  });

  controls.sync();
  expect(elements['rp-rotate-toggle'].getAttribute('aria-pressed')).toBe('false');
  expect(elements['rp-rotate-speed-row'].classList.contains('disabled')).toBe(true);
  elements['rp-rotate-toggle'].emit('click');
  expect(state.enabled).toBe(true);
  expect(elements['rp-rotate-toggle'].getAttribute('aria-pressed')).toBe('true');

  const speedInput = elements['rp-rotate-speed'];
  documentLike.activeElement = speedInput;
  speedInput.value = '-0.25';
  speedInput.emit('input');
  expect(state.speed).toBe(-0.25);
  expect(speedInput.value).toBe('-0.25');
  expect(elements['rp-rotate-speed-val'].textContent).toBe('-0.250');
  expect(changes).toBe(2);
});

test('scene settings controller keeps backdrop and compatibility controls synchronized', async () => {
  const { createSceneSettingsController } = await importAppModule('ui/controls', 'scene-settings-controller.js');
  class FakeElement {
    constructor() {
      this.value = '';
      this.style = {};
      this.classes = new Set();
      this.attributes = new Map();
      this.classList = {
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
  }
  const elements = Object.fromEntries([
    'bg-color', 'bg-color-2', 'toggle-bg-gradient', 'toggle-rotate', 'rotate-speed',
  ].map(id => [id, new FakeElement()]));
  const documentLike = {
    body: { style: {} },
    activeElement: null,
    getElementById: id => elements[id],
  };
  const settings = {
    backgroundColor: '#000000', secondaryBackgroundColor: '#ffffff', gradientAmount: 0,
    rotationEnabled: false, rotationSpeed: 0.1,
  };
  let transparentCalls = 0;
  const controller = createSceneSettingsController({
    documentLike,
    settings,
    sceneRuntime: { setTransparentBackground: () => { transparentCalls += 1; } },
  });

  controller.setPrimaryColor('#112233');
  controller.setSecondaryColor('#445566');
  controller.setGradientAmount(2);
  controller.setRotationEnabled(true);
  controller.setRotationSpeed(-0.25);

  expect(settings).toMatchObject({
    backgroundColor: '#112233', secondaryBackgroundColor: '#445566', gradientAmount: 1,
    rotationEnabled: true, rotationSpeed: -0.25,
  });
  expect(documentLike.body.style.background).toContain('#445566');
  expect(elements['toggle-bg-gradient'].attributes.get('aria-pressed')).toBe('true');
  expect(elements['toggle-rotate'].classes.has('active')).toBe(true);
  expect(elements['rotate-speed'].style.display).toBe('');
  expect(elements['rotate-speed'].value).toBe(-0.25);
  expect(transparentCalls).toBe(3);
});

test('preset gallery owns card presentation, loading, and debounced live previews', async () => {
  const { createPresetGallery } = await importAppModule('ui/shell', 'preset-gallery.js');
  class FakeElement {
    constructor() {
      this.listeners = new Map();
      this.classes = new Set();
      this.attributes = new Map();
      this.style = {};
      this.children = [];
      this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({}); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes.set(name, value); }
  }
  const cards = [new FakeElement(), new FakeElement(), new FakeElement()];
  const arrow = new FakeElement();
  const scheduled = [];
  const cancelled = [];
  const loaded = [];
  const restored = [];
  let reset = 0;
  let dirty = false;
  let preview = 0;
  const gallery = createPresetGallery({
    documentLike: {
      querySelectorAll: () => cards,
      querySelector: () => arrow,
      createElement: () => new FakeElement(),
    },
    presets: [
      { emotion: 'calm', label: 'Calm' },
      { emotion: 'warm', label: 'Warm' },
    ],
    captureCurrentPreview: () => `preview-${++preview}`,
    serializeDefault: () => 'default preset',
    restoreDefault: text => restored.push(text),
    loadPreset: emotion => loaded.push(emotion),
    hasUnsavedChanges: () => dirty,
    resetUnsavedState: () => { reset += 1; },
    confirmDiscard: () => false,
    schedule: callback => { scheduled.push(callback); return scheduled.length; },
    cancelSchedule: timer => cancelled.push(timer),
  });

  expect(cards[0].children[0].textContent).toBe('New preset');
  expect(cards[0].attributes.get('aria-pressed')).toBe('true');
  expect(gallery.captureDefault()).toBe(true);
  expect(cards[0].style.backgroundImage).toBe('url(preview-1)');
  cards[1].onclick();
  await Promise.resolve();
  expect(loaded).toEqual(['calm']);
  expect(cards[1].attributes.get('aria-pressed')).toBe('true');

  dirty = true;
  cards[0].onclick();
  expect(restored).toEqual([]); // rejected confirmation preserves the draft
  dirty = false;
  cards[0].onclick();
  expect(restored).toEqual(['default preset']);
  expect(reset).toBe(1);

  gallery.queuePreviewRefresh();
  gallery.queuePreviewRefresh();
  expect(cancelled).toEqual([1]);
  scheduled.at(-1)();
  expect(cards[0].style.backgroundImage).toBe('url(preview-3)');
  arrow.emit('click');
  expect(cards[0].children[0].textContent).toBe('Calm');
});

test('panel shell keeps visual, accessibility, and viewport state synchronized', async () => {
  const { createPanelShell } = await importAppModule('ui/shell', 'panel-shell.js');
  class FakeElement {
    constructor() {
      this.listeners = new Map();
      this.classes = new Set();
      this.attributes = new Map();
      this.style = {};
      this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({}); }
    setAttribute(name, value) { this.attributes.set(name, value); }
  }
  const elements = Object.fromEntries([
    'redesign-panel', 'rp-collapse-btn', 'rp-collapse-rail', 'anim-canvas-controls',
  ].map(id => [id, new FakeElement()]));
  const body = new FakeElement();
  const scheduled = [];
  let layouts = 0;
  createPanelShell({
    documentLike: { body, getElementById: id => elements[id] },
    onLayout: () => { layouts += 1; },
    schedule: (callback, delay) => scheduled.push([callback, delay]),
  });

  elements['rp-collapse-btn'].emit('click');
  expect(elements['redesign-panel'].classes.has('collapsed')).toBe(true);
  expect(body.classes.has('rp-collapsed')).toBe(true);
  expect(elements['rp-collapse-btn'].attributes.get('aria-expanded')).toBe('false');
  expect(elements['anim-canvas-controls'].style.left).toBe('0');
  expect(layouts).toBe(1);
  expect(scheduled[0][1]).toBe(280);
  scheduled[0][0]();
  expect(layouts).toBe(2);

  elements['rp-collapse-rail'].emit('click');
  expect(body.classes.has('rp-collapsed')).toBe(false);
  expect(elements['rp-collapse-rail'].attributes.get('aria-expanded')).toBe('true');
  expect(elements['anim-canvas-controls'].style.left).toBe('339px');
});

test('runtime error overlay exposes synchronous and async boot failures', async () => {
  const { installRuntimeErrorOverlay } = await importAppModule('ui', 'runtime-errors.js');
  const documentListeners = new Map();
  const windowListeners = new Map();
  const body = { appendChild(element) { this.child = element; } };
  const documentLike = {
    body,
    createElement: () => ({ style: {}, textContent: '' }),
    addEventListener: (type, listener) => documentListeners.set(type, listener),
  };
  const windowLike = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
  };
  const overlay = installRuntimeErrorOverlay({ windowLike, documentLike });

  documentListeners.get('DOMContentLoaded')();
  expect(body.child).toBe(overlay);
  windowListeners.get('error')({ message: 'renderer failed' });
  expect(overlay.textContent).toBe('renderer failed');
  expect(overlay.style.display).toBe('block');
  windowListeners.get('unhandledrejection')({ reason: 'preset failed' });
  expect(overlay.textContent).toContain('preset failed');
});

test('editor viewport maps panel and timeline geometry into scene layout', async () => {
  const { createEditorViewport } = await importAppModule('ui/shell', 'editor-viewport.js');
  const calls = [];
  let panelCollapsed = false;
  let timelineOpen = true;
  let resizeListener;
  const panel = {
    offsetWidth: 220,
    classList: { contains: name => name === 'collapsed' && panelCollapsed },
  };
  const timeline = {
    classList: { contains: name => name === 'open' && timelineOpen },
    getBoundingClientRect: () => ({ height: 180 }),
  };
  const windowLike = {
    innerWidth: 1000,
    innerHeight: 700,
    addEventListener(type, listener) { if (type === 'resize') resizeListener = listener; },
    removeEventListener(type, listener) { calls.push(['remove', type, listener]); },
  };
  const documentLike = {
    getElementById(id) {
      return id === 'redesign-panel' ? panel : id === 'anim-canvas-controls' ? timeline : null;
    },
  };
  const sceneRuntime = {
    resize: (...args) => calls.push(['resize', ...args]),
    setVerticalViewOffset: (...args) => calls.push(['offset', ...args]),
  };
  const viewport = createEditorViewport({
    windowLike,
    documentLike,
    sceneRuntime,
    onSceneResize: (...args) => calls.push(['scene-resize', ...args]),
  });

  viewport.connect();
  expect(calls).toContainEqual(['resize', 780, 700, 220]);
  expect(calls).toContainEqual(['offset', 780, 700, 180]);
  expect(calls).toContainEqual(['scene-resize', 780, 700]);

  panelCollapsed = true;
  timelineOpen = false;
  resizeListener();
  expect(calls).toContainEqual(['resize', 1000, 700, 0]);
  expect(calls).toContainEqual(['offset', 1000, 700, 0]);

  viewport.disconnect();
  expect(calls.at(-1)).toEqual(['remove', 'resize', resizeListener]);
});

test('firefly field controls synchronize layer edits without fighting focused inputs', async () => {
  const {
    createFireflyFieldControls,
    FIREFLY_SLIDER_DEFINITIONS,
  } = await importAppModule('ui/controls', 'firefly-field-controls.js');

  class FakeElement {
    constructor() {
      this.children = [];
      this.afterItems = [];
      this.listeners = new Map();
      this.style = {};
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
        contains: name => this.classes.has(name),
      };
      this.value = '';
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); return child; }
    after(...items) { this.afterItems.push(...items); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    dispatch(type) { this.listeners.get(type)?.({ target: this }); }
  }

  const tabs = new FakeElement();
  const panel = new FakeElement();
  const documentLike = {
    activeElement: null,
    createElement: () => new FakeElement(),
    getElementById: id => id === 'firefly-layer-tabs' ? tabs : panel,
  };
  const makeLayer = (hex, count) => ({
    name: null,
    overrides: {},
    params: Object.fromEntries(FIREFLY_SLIDER_DEFINITIONS.map(([key, min]) => [key, key === 'count' ? count : min])),
    color: () => ({ getHexString: () => hex }),
    setParams(patch) { Object.assign(this.params, patch); },
  });
  const layers = [makeLayer('112233', 100), makeLayer('445566', 200)];
  let activeIndex = 0;
  let selectionSyncs = 0;
  let panelSyncs = 0;
  const controls = createFireflyFieldControls({
    documentLike,
    getLayers: () => layers,
    getActiveIndex: () => activeIndex,
    setActiveIndex: index => { activeIndex = index; },
    getActiveEmotion: () => 'calm',
    isAnimating: () => false,
    isEditingPhase: () => false,
    onAdd: () => null,
    onSplit: () => null,
    onRemove: () => null,
    onSelectionSync: () => { selectionSyncs += 1; },
    onPanelSync: () => { panelSyncs += 1; },
    setPressed: (element, pressed) => { element.pressed = pressed; },
  });

  controls.sync();
  expect(tabs.children[1].textContent).toBe('1 / 2');
  expect(panel.children[0].children[1].value).toBe('#112233');
  expect(panel.children[0].children[2].pressed).toBe(true);

  tabs.children[2].dispatch('click');
  expect(activeIndex).toBe(1);
  expect(tabs.children[1].textContent).toBe('2 / 2');

  const [nameInput] = tabs.afterItems;
  nameInput.value = 'Highlights';
  nameInput.dispatch('input');
  expect(layers[1].name).toBe('Highlights');

  const colorInput = panel.children[0].children[1];
  colorInput.value = '#abcdef';
  colorInput.dispatch('input');
  expect(layers[1].overrides.calm).toBe('#abcdef');

  const countInput = panel.children[1].children[1];
  countInput.value = '315';
  countInput.dispatch('input');
  expect(layers[1].params.count).toBe(315);
  expect(layers[1].idle.count).toBe(315);

  // A frame refresh may update other controls, but must leave the value under
  // an active pointer/caret untouched until the user releases it.
  documentLike.activeElement = countInput;
  countInput.value = '321';
  layers[1].params.count = 400;
  controls.sync();
  expect(countInput.value).toBe('321');
  expect(selectionSyncs).toBeGreaterThan(1);
  expect(panelSyncs).toBeGreaterThan(1);
});

test('core prototype controls synchronize asynchronous core sliders and selection', async () => {
  const { createCorePrototypeControls } = await importAppModule('ui/controls', 'core-prototype-controls.js');
  const input = { step: '0.1', value: '' };
  const output = { textContent: '' };
  const label = { textContent: 'scale' };
  const row = {
    querySelector: selector => ({ span: label, input, em: output }[selector] ?? null),
  };
  const calls = [];
  const controls = createCorePrototypeControls({
    documentLike: { querySelectorAll: () => [row] },
    prototypes: { core: { scale: 1 }, dense: { scale: 2.34 } },
    emotionControls: { setPrototypeActive: name => calls.push(['active', name]) },
    getCore: () => ({ setPrototype: value => calls.push(['core', value.scale]) }),
  });

  expect(controls.select('missing')).toBe(false);
  expect(controls.select('dense')).toBe(true);
  expect(controls.activeName).toBe('dense');
  expect(input.value).toBe(2.34);
  expect(output.textContent).toBe('2.34');
  expect(calls).toEqual([['active', 'dense'], ['core', 2.34]]);
});

test('classic emitter controls edit shared state and preserve a focused slider', async () => {
  const {
    CLASSIC_SLIDER_DEFINITIONS,
    createClassicEmitterControls,
  } = await importAppModule('ui/controls', 'classic-emitter-controls.js');
  class FakeElement {
    constructor() { this.children = []; this.listeners = new Map(); this.value = ''; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    dispatch(type) { this.listeners.get(type)?.({ target: this }); }
  }
  const container = new FakeElement();
  const documentLike = {
    activeElement: null,
    createElement: () => new FakeElement(),
    getElementById: () => container,
  };
  const state = Object.fromEntries(CLASSIC_SLIDER_DEFINITIONS.map(([key, min]) => [key, min]));
  const controls = createClassicEmitterControls({ documentLike, state });
  const scaleInput = container.children[0].children[1];
  const scaleValue = container.children[0].children[2];

  scaleInput.value = '1.25';
  scaleInput.dispatch('input');
  expect(state.scale).toBe(1.25);
  expect(scaleValue.textContent).toBe('1.25');

  documentLike.activeElement = scaleInput;
  scaleInput.value = '1.31';
  state.scale = 1.5;
  controls.sync();
  expect(scaleInput.value).toBe('1.31');
  expect(scaleValue.textContent).toBe('1.50');
});

test('sphere mode controls apply one visibility matrix to scene and legacy UI', async () => {
  const { createSphereModeControls } = await importAppModule('ui/controls', 'sphere-mode-controls.js');
  class FakeElement {
    constructor() {
      this.style = {};
      this.listeners = new Map();
      this.classes = new Set();
      this.classList = {
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    click() { this.listeners.get('click')?.(); }
  }
  const ids = [
    'mode-circles', 'mode-fireflies', 'toggle-fireflies',
    'firefly-field-heading', 'firefly-layer-tabs', 'firefly-field-controls',
    'classic-heading', 'classic-controls',
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
  const circleLayers = [{ points: { visible: true } }, { points: { visible: true } }];
  const classicObjects = [{ visible: false }, { visible: false }];
  const shellPoints = { visible: false };
  const pressed = [];
  let mode = null;
  const controls = createSphereModeControls({
    documentLike: { getElementById: id => elements[id] },
    getCircleLayers: () => circleLayers,
    classicObjects,
    shellPoints,
    setMode: value => { mode = value; },
    setPressed: (element, value) => pressed.push([element, value]),
  });

  controls.apply('fireflies');
  expect(mode).toBe('fireflies');
  expect(circleLayers.every(layer => !layer.points.visible)).toBe(true);
  expect(classicObjects.every(object => object.visible)).toBe(true);
  expect(shellPoints.visible).toBe(true);
  expect(elements['firefly-field-controls'].style.display).toBe('none');
  expect(elements['classic-controls'].style.display).toBe('');

  elements['mode-circles'].click();
  expect(mode).toBe('circles');
  expect(circleLayers.every(layer => layer.points.visible)).toBe(true);
  expect(classicObjects.every(object => !object.visible)).toBe(true);
  expect(elements['classic-controls'].style.display).toBe('none');
  expect(pressed.length).toBeGreaterThan(0);
});
