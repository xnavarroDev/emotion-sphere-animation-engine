const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Retained compatibility controls and legacy editor presenters.

test('legacy view controls forward compatibility inputs to canonical scene state', async () => {
  const { createLegacyViewControls } = await importAppModule('ui/legacy', 'legacy-view-controls.js');
  class FakeControl {
    constructor(active = false) {
      this.listeners = new Map();
      this.attributes = new Map();
      this.active = active;
      this.value = '';
      this.classList = { toggle: name => {
        if (name === 'active') this.active = !this.active;
        return this.active;
      } };
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({ target: this }); }
    setAttribute(name, value) { this.attributes.set(name, value); }
  }
  const ids = [
    'toggle-glow', 'toggle-fireflies', 'glow-color', 'glow-opacity', 'bg-color',
    'bg-color-2', 'toggle-bg-gradient', 'toggle-rotate', 'rotate-speed',
  ];
  const controls = Object.fromEntries(ids.map(id => [id, new FakeControl(id.startsWith('toggle-'))]));
  const calls = [];
  createLegacyViewControls({
    documentLike: { getElementById: id => controls[id] },
    getGradientAmount: () => 0.5,
    getRotationEnabled: () => true,
    setGlowVisible: value => calls.push(['glow-visible', value]),
    setFirefliesVisible: value => calls.push(['fireflies-visible', value]),
    setGlowColor: value => calls.push(['glow-color', value]),
    setGlowOpacity: value => calls.push(['glow-opacity', value]),
    setPrimaryBackground: value => calls.push(['background-a', value]),
    setSecondaryBackground: value => calls.push(['background-b', value]),
    setGradientAmount: value => calls.push(['gradient', value]),
    setRotationEnabled: value => calls.push(['rotate', value]),
    setRotationSpeed: value => calls.push(['rotate-speed', value]),
  });
  controls['toggle-glow'].emit('click');
  controls['glow-color'].value = '#123456'; controls['glow-color'].emit('input');
  controls['glow-opacity'].value = '0.4'; controls['glow-opacity'].emit('input');
  controls['toggle-bg-gradient'].emit('click');
  controls['toggle-rotate'].emit('click');
  controls['rotate-speed'].value = '-0.2'; controls['rotate-speed'].emit('input');
  expect(calls).toEqual([
    ['glow-visible', false], ['glow-color', '#123456'], ['glow-opacity', 0.4],
    ['gradient', 0], ['rotate', false], ['rotate-speed', -0.2],
  ]);
  expect(controls['toggle-glow'].attributes.get('aria-pressed')).toBe('false');
});

test('legacy disclosure synchronizes inline visibility, chevron, and ARIA state', async () => {
  const { wireLegacyDisclosure } = await importAppModule('ui/shell', 'disclosures.js');
  const listeners = new Map();
  const attributes = new Map();
  const trigger = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const body = { style: {} };
  const chevron = { style: {} };
  wireLegacyDisclosure({ trigger, body, chevron });
  expect(body.style.display).toBe('');
  expect(attributes.get('aria-expanded')).toBe('true');
  listeners.get('click')();
  expect(body.style.display).toBe('none');
  expect(chevron.style.transform).toBe('rotate(0deg)');
  expect(attributes.get('aria-expanded')).toBe('false');
});

test('legacy preset actions delegate format work and own browser I/O feedback', async () => {
  const { createLegacyPresetActions } = await importAppModule('ui/legacy', 'legacy-preset-actions.js');
  const makeButton = text => ({
    textContent: text,
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    click() { return this.listeners.get('click')?.({}); },
  });
  const buttons = Object.fromEntries([
    ['copy-params', 'Copy'], ['share-link', 'Link'], ['save-params', 'Save'], ['load-params', 'Load'],
  ].map(([id, text]) => [id, makeButton(text)]));
  const anchor = { clickCalled: false, click() { this.clickCalled = true; } };
  const written = [];
  const applied = [];
  const revoked = [];
  createLegacyPresetActions({
    documentLike: {
      getElementById: id => buttons[id],
      createElement: () => anchor,
    },
    clipboard: {
      writeText: async text => written.push(text),
      readText: async () => 'loaded preset',
    },
    serialize: () => 'current preset',
    apply: text => applied.push(text),
    createShareUrl: text => `share:${text}`,
    BlobCtor: class { constructor(parts) { this.parts = parts; } },
    urlApi: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: value => revoked.push(value),
    },
    now: () => 123,
    schedule: () => {},
  });
  await buttons['copy-params'].click();
  await buttons['share-link'].click();
  buttons['save-params'].click();
  await buttons['load-params'].click();
  await Promise.resolve();
  expect(written).toEqual(['current preset', 'share:current preset']);
  expect(applied).toEqual(['loaded preset']);
  expect(anchor.download).toBe('particle-params-123.txt');
  expect(anchor.clickCalled).toBe(true);
  expect(revoked).toEqual(['blob:test']);
});

test('legacy animation transport mirrors playback and loop state', async () => {
  const { createLegacyAnimationTransport } = await importAppModule('ui/legacy', 'legacy-animation-transport.js');
  const makeControl = () => ({
    listeners: new Map(), checked: true, classes: new Set(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    emit(type) { this.listeners.get(type)?.({}); },
    classList: { toggle() {} },
  });
  const play = makeControl();
  play.classList.toggle = (name, enabled) => enabled ? play.classes.add(name) : play.classes.delete(name);
  const loop = makeControl();
  const calls = [];
  const transport = createLegacyAnimationTransport({
    playButton: play,
    loopCheckbox: loop,
    onPlayToggle: () => calls.push('play'),
    onLoopChange: value => calls.push(['loop', value]),
  });
  transport.setPlaying(true);
  transport.setLoop(false);
  expect(play.classes.has('active')).toBe(true);
  expect(loop.checked).toBe(false);
  play.emit('click'); loop.emit('change');
  expect(calls).toEqual(['play', ['loop', false]]);
});

test('legacy phase list renders feedback while delegating timeline mutation', async () => {
  const { createLegacyPhaseList } = await importAppModule('ui/legacy', 'legacy-phase-list.js');
  class FakeElement {
    constructor(fragment = false) {
      this.fragment = fragment;
      this.children = [];
      this.listeners = new Map();
      this.classes = new Set();
      this.style = {};
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    appendChild(child) {
      if (child.fragment) this.children.push(...child.children);
      else this.children.push(child);
      return child;
    }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({ target: this }); }
    querySelectorAll(selector) {
      const all = [];
      const visit = element => {
        if (selector === '.anim-phase-row' && element.className === 'anim-phase-row') all.push(element);
        element.children?.forEach(visit);
      };
      this.children.forEach(visit);
      return all;
    }
  }
  const container = new FakeElement();
  const timeline = [{ duration: 2, snapshot: { value: 1 } }];
  const calls = [];
  const list = createLegacyPhaseList({
    documentLike: {
      createElement: () => new FakeElement(),
      createDocumentFragment: () => new FakeElement(true),
    },
    container,
    getTimeline: () => timeline,
    onEdit: phase => calls.push(['edit', phase]),
    onCapture: phase => { phase.snapshot = { value: 2 }; },
    onClear: phase => { phase.snapshot = null; },
    onDuration: (phase, duration) => { phase.duration = duration; },
    onAdd: phases => phases.push({ duration: 5, snapshot: {} }),
    schedule: () => {},
  });
  list.render();
  const row = container.querySelectorAll('.anim-phase-row')[0];
  const [dot,, edit, capture, clear] = row.children;
  edit.emit('click');
  expect(calls).toEqual([['edit', timeline[0]]]);
  expect(row.classes.has('editing')).toBe(true);
  clear.emit('click');
  expect(dot.classes.has('set')).toBe(false);
  capture.emit('click');
  expect(dot.classes.has('set')).toBe(true);
  const durationInput = container.children[1].children[0];
  durationInput.value = '3.5'; durationInput.emit('change');
  expect(timeline[0].duration).toBe(3.5);
  container.children.at(-1).emit('click');
  expect(timeline).toHaveLength(2);
  expect(container.querySelectorAll('.anim-phase-row')).toHaveLength(2);
});
