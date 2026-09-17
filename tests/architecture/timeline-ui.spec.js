const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Modern timeline presenters, gestures, editing, and rendering.

test('timeline gesture controller converts pointer movement into timeline intent', async () => {
  const { createTimelineGestureController } = await importAppModule('ui/timeline', 'timeline-gestures.js');

  // A tiny event target keeps this test independent of a browser DOM. The
  // controller should only require pointer events and lane geometry.
  class FakeElement {
    constructor(width = 200) {
      this.width = width;
      this.listeners = new Map();
      this.captured = [];
      this.released = [];
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type, values = {}) {
      const event = {
        pointerId: 1,
        clientX: 0,
        movementX: 0,
        target: { closest: () => null },
        stopPropagation() {},
        ...values,
      };
      for (const listener of this.listeners.get(type) || []) listener(event);
    }
    getBoundingClientRect() { return { width: this.width }; }
    setPointerCapture(id) { this.captured.push(id); }
    releasePointerCapture(id) { this.released.push(id); }
  }

  const seeks = [];
  let deferred;
  const gestures = createTimelineGestureController({
    getAxisSeconds: () => 20,
    seekToClientX: x => seeks.push(x),
    defer: callback => { deferred = callback; },
  });

  const handle = new FakeElement();
  const lane = new FakeElement(200);
  const resizeDeltas = [];
  let commits = 0;
  gestures.wireSegmentResize({
    handle,
    lane,
    edge: 'left',
    onResize: delta => resizeDeltas.push(delta),
    onCommit: () => { commits += 1; },
  });
  handle.emit('pointerdown');
  handle.emit('pointermove', { movementX: 10 });
  handle.emit('pointerup');
  expect(resizeDeltas).toEqual([-1]);
  expect(commits).toBe(1);

  gestures.wireLaneScrub(lane);
  lane.emit('pointerdown', { clientX: 100 });
  lane.emit('pointermove', { clientX: 102 });
  expect(seeks).toEqual([]); // below the drag threshold: still a plain click
  lane.emit('pointermove', { clientX: 106 });
  expect(seeks).toEqual([106]);
  lane.emit('pointerup');
  expect(gestures.wasLaneDrag()).toBe(true);
  deferred();
  expect(gestures.wasLaneDrag()).toBe(false);
});

test('timeline editor helpers normalize names and validate typed durations', async () => {
  const {
    normalizeTimelineName,
    parseTimelineDuration,
  } = await importAppModule('ui/timeline', 'timeline-editors.js');

  expect(normalizeTimelineName('  Climax  ')).toBe('Climax');
  expect(normalizeTimelineName('   ')).toBeNull();
  expect(parseTimelineDuration('6.25s')).toBe(6.25);
  expect(parseTimelineDuration('0.1 seconds', 0.5)).toBe(0.5);
  expect(parseTimelineDuration('not a duration')).toBeNull();
});

test('live phase editor commits snapshots and defers expensive visual feedback', async () => {
  const { createLivePhaseEditor } = await importAppModule('ui/timeline', 'live-phase-editor.js');
  const classChanges = [];
  const makeView = () => ({
    swatch: {
      style: {},
      classList: {
        remove: name => classChanges.push(['remove', name]),
        add: name => classChanges.push(['add', name]),
      },
      offsetWidth: 20,
    },
    isScene: false,
    pi: 2,
  });
  let currentView = makeView();
  let scheduled;
  let stopped = false;
  let renders = 0;
  const invalidated = [];
  const phase = { duration: 5, snapshot: null };
  const editor = createLivePhaseEditor({
    captureSnapshot: () => ({ params: { count: 12 } }),
    getSelection: () => ({ getPhaseView: selected => selected === phase ? currentView : null }),
    segmentTint: (selected, isScene, index) => `${selected.duration}:${isScene}:${index}`,
    invalidateTrack: index => invalidated.push(index),
    getActiveTrackIndex: () => 3,
    isTimelineOpen: () => true,
    render: () => { renders += 1; currentView = makeView(); },
    onStop: () => { stopped = true; },
    schedule: (callback, delay) => { scheduled = { callback, delay }; return 7; },
    cancel: () => {},
  });

  expect(editor.commit()).toBe(false);
  editor.setPhase(phase);
  expect(editor.commit()).toBe(true);
  expect(phase.snapshot).toEqual({ params: { count: 12 } });
  expect(currentView.swatch.style.background).toBe('5:false:2');
  expect(invalidated).toEqual([3]);
  expect(scheduled.delay).toBe(600);

  scheduled.callback();
  expect(renders).toBe(1);
  expect(classChanges).toEqual([
    ['remove', 'rp-save-flash'],
    ['add', 'rp-save-flash'],
  ]);
  editor.clear();
  expect(editor.phase).toBeNull();
  expect(stopped).toBe(true);
});

test('timeline selection presenter groups phase highlights and reveals scene controls', async () => {
  const { createTimelineSelectionPresenter } = await importAppModule('ui/timeline', 'timeline-selection.js');

  class FakeElement {
    constructor() {
      this.listeners = new Map();
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
        contains: name => this.classes.has(name),
      };
      this.style = {};
      this.children = [];
      this.isConnected = true;
      this.offsetLeft = 40;
      this.offsetWidth = 80;
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type, target = this) {
      const eventTarget = target.closest ? target : { closest: () => null };
      for (const listener of this.listeners.get(type) || []) listener({ target: eventTarget });
    }
    appendChild(child) { this.children.push(child); }
    closest() { return null; }
  }

  const overlay = new FakeElement();
  const controls = {
    paramsSection: new FakeElement(),
    paramsHeader: new FakeElement(),
    paramsChevron: new FakeElement(),
    backgroundGroup: new FakeElement(),
    backgroundHeader: new FakeElement(),
    backgroundChevron: new FakeElement(),
  };
  controls.paramsSection.classList.add('collapsed');
  const expanded = [];
  const presenter = createTimelineSelectionPresenter({
    documentLike: { createElement: () => new FakeElement() },
    getOverlay: () => overlay,
    getLaneScroll: () => 15,
    sceneControls: controls,
    setExpanded: (element, value) => expanded.push([element, value]),
  });

  const phase = {};
  const firstSegment = new FakeElement();
  const firstName = new FakeElement();
  const secondSegment = new FakeElement();
  const secondName = new FakeElement();
  presenter.registerPhase({
    phase, segment: firstSegment, nameElement: firstName, swatch: {},
    isScene: false, phaseIndex: 0, displayedName: 'Climax',
  });
  presenter.registerPhase({
    phase: {}, segment: secondSegment, nameElement: secondName, swatch: {},
    isScene: true, phaseIndex: 0, displayedName: 'climax',
  });
  firstSegment.emit('mouseenter');
  expect([firstSegment, firstName, secondSegment, secondName]
    .every(element => element.classList.contains('hl'))).toBe(true);
  expect(overlay.children[0].style.left).toBe('25px');
  expect(overlay.children[0].style.width).toBe('80px');
  firstSegment.emit('mouseleave');
  expect(overlay.children[0].style.display).toBe('none');
  expect(presenter.getPhaseView(phase).pi).toBe(0);

  let selected = false;
  presenter.wirePhaseSelection({
    segment: secondSegment,
    isScene: true,
    shouldIgnore: () => false,
    onSelect: () => { selected = true; },
  });
  secondSegment.emit('click');
  expect(selected).toBe(true);
  expect(controls.paramsSection.classList.contains('collapsed')).toBe(false);
  expect(controls.backgroundGroup.classList.contains('open')).toBe(true);
  expect(expanded).toEqual([
    [controls.paramsHeader, true],
    [controls.backgroundHeader, true],
  ]);

  presenter.reset();
  expect(presenter.getPhaseView(phase)).toBeUndefined();
});

test('timeline panel lays out before rendering and exposes one open path', async () => {
  const { createTimelinePanel } = await importAppModule('ui/timeline', 'timeline-panel.js');
  class FakeElement {
    constructor() {
      this.listeners = new Map();
      this.classes = new Set();
      this.attributes = new Map();
      this.classList = {
        contains: name => this.classes.has(name),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({}); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getBoundingClientRect() { return { height: 187.6 }; }
  }
  const trigger = new FakeElement();
  const chevron = new FakeElement();
  trigger.querySelector = () => chevron;
  const container = new FakeElement();
  const grip = new FakeElement();
  const order = [];
  const panel = createTimelinePanel({
    documentLike: {
      getElementById: id => ({
        'rp-animation-row': trigger,
        'anim-canvas-controls': container,
        'rp-anim-resize': grip,
      })[id],
    },
    onLayout: () => order.push('layout'),
    onOpen: () => order.push('render'),
  });

  expect(panel.isOpen()).toBe(false);
  expect(panel.ensureOpen()).toBe(true);
  expect(order).toEqual(['layout', 'render']);
  expect(trigger.attributes.get('aria-expanded')).toBe('true');
  expect(chevron.classes.has('rp-flip-x')).toBe(true);
  expect(grip.attributes.get('aria-valuenow')).toBe('188');
  expect(panel.ensureOpen()).toBe(true);
  expect(order).toEqual(['layout', 'render']); // already open: no duplicate work
  trigger.emit('click');
  expect(panel.isOpen()).toBe(false);
  expect(trigger.attributes.get('aria-expanded')).toBe('false');
  expect(order).toEqual(['layout', 'render', 'layout']);
});

test('timeline lane relayout preserves DOM nodes while updating shared-axis geometry', async () => {
  const { relayoutTimelineLane } = await importAppModule('ui/timeline', 'timeline-lanes.js');
  const makeRecord = duration => ({
    phase: { duration },
    seg: { style: {} },
    nameEl: { style: {} },
    durEl: { style: {} },
    durText: { textContent: '' },
    bracket: { style: {} },
    seam: { style: {} },
  });
  const records = [makeRecord(5), makeRecord(10)];
  const lane = {
    _timeline: records.map(record => record.phase),
    _segs: records,
  };

  expect(relayoutTimelineLane(lane, 20)).toBe(true);
  expect(records[0].seg.style).toEqual({ left: '0%', width: '25%' });
  expect(records[0].nameEl.style.left).toBe('12.5%');
  expect(records[0].durText.textContent).toBe('5.0s');
  expect(records[1].seg.style).toEqual({ left: '25%', width: '50%' });
  expect(records[1].bracket.style).toEqual({ left: '25%', width: '50%' });
  expect(records[1].seam.style.left).toBe('75%');
  expect(relayoutTimelineLane(null, 20)).toBe(false);
});

test('timeline lane presenter synchronizes scrolling and updates one shared playhead', async () => {
  const { createTimelineLanePresenter } = await importAppModule('ui/timeline', 'timeline-lanes.js');
  class FakeElement {
    constructor() {
      this.listeners = new Map();
      this.children = [];
      this.style = {};
      this.scrollLeft = 0;
      this.scrollTop = 12;
      this.clientHeight = 200;
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({}); }
    appendChild(child) { this.children.push(child); child.parentElement = this; }
  }
  const tracks = new FakeElement();
  const lastTrack = { offsetTop: 160, offsetHeight: 70 };
  tracks.querySelectorAll = () => [lastTrack];
  const time = new FakeElement();
  const wired = [];
  const presenter = createTimelineLanePresenter({
    documentLike: { createElement: () => new FakeElement() },
    tracksElement: tracks,
    timeElement: time,
    formatTime: seconds => `${seconds}s`,
    wirePlayheadScrub: playhead => wired.push(playhead),
  });
  const firstViewport = new FakeElement();
  firstViewport.offsetLeft = 180;
  firstViewport.clientWidth = 400;
  const secondViewport = new FakeElement();
  const lane = new FakeElement();
  lane.offsetWidth = 680;
  lane.parentElement = firstViewport;
  presenter.registerViewport(firstViewport);
  presenter.registerViewport(secondViewport);
  presenter.setAxis({ lane, duration: 10, visibleSeconds: 20 });
  const overlay = presenter.createOverlay();

  expect(wired).toHaveLength(1);
  expect(overlay.style.left).toBe('180px');
  expect(overlay.style.height).toBe('230px');
  presenter.updatePlayhead(5);
  expect(overlay.children[0].style.left).toBe('170px');
  expect(time.textContent).toBe('5s/10s');
  firstViewport.scrollLeft = 40;
  firstViewport.emit('scroll');
  expect(secondViewport.scrollLeft).toBe(40);
  expect(overlay.children[0].style.left).toBe('130px');

  const preserved = presenter.reset();
  expect(preserved).toEqual({ top: 12, left: 40 });
  presenter.registerViewport(firstViewport);
  presenter.restoreScroll(preserved);
  expect(firstViewport.scrollLeft).toBe(40);
});

test('timeline track toggle presents state and emits isolated user intent', async () => {
  const { createTrackToggle } = await importAppModule('ui/timeline', 'timeline-elements.js');
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  const element = {
    classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
    addEventListener: (type, listener) => listeners.set(type, listener),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  let changes = 0;
  let stopped = false;
  const toggle = createTrackToggle({
    documentLike: { createElement: () => element },
    label: 'Background',
    enabled: true,
    onToggle: () => { changes += 1; },
  });

  expect(toggle.className).toBe('rp-switch on');
  expect(attributes.get('aria-label')).toBe('Background animation');
  expect(attributes.get('aria-pressed')).toBe('true');
  listeners.get('click')({ stopPropagation: () => { stopped = true; } });
  expect(changes).toBe(1);
  expect(stopped).toBe(true);
});

test('phase-row wiring connects every phase control without owning timeline state', async () => {
  const { wireTimelinePhaseRow } = await importAppModule('ui/timeline', 'timeline-phase-row.js');
  const makeElement = () => ({
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    emit(type) {
      let stopped = false;
      this.listeners.get(type)?.({ stopPropagation: () => { stopped = true; } });
      return stopped;
    },
  });
  const elements = {
    segment: makeElement(), swatch: makeElement(), resizeLeft: makeElement(), resizeRight: makeElement(),
    deleteButton: makeElement(), name: makeElement(), bracketLeft: makeElement(), bracketRight: makeElement(),
    durationText: makeElement(), easingIcon: makeElement(), seam: makeElement(),
  };
  const calls = [];
  const selection = {
    wirePhaseSelection: options => calls.push(['selection', options]),
    registerPhase: options => calls.push(['register', options]),
  };
  const phase = { name: 'Build', duration: 3 };
  wireTimelinePhaseRow({
    documentLike: {}, windowLike: {}, phase, phaseIndex: 1, lane: 'lane', isScene: false,
    displayedName: 'Build', elements, selection, wasLaneDrag: () => false,
    wireResize: (element, wiredPhase, lane, edge) => calls.push(['resize', element, wiredPhase, lane, edge]),
    onSelect: () => calls.push('select'), onDelete: () => calls.push('delete'),
    onRename: name => calls.push(['rename', name]), onDuration: value => calls.push(['duration', value]),
    onEasing: anchor => calls.push(['easing', anchor]), onInsert: () => calls.push('insert'),
    bindName: options => options.onCommit('Climax'),
    bindDuration: options => options.onCommit(4.5),
  });

  expect(calls.filter(call => Array.isArray(call) && call[0] === 'resize').map(call => call[4]))
    .toEqual(['left', 'right', 'left', 'right']);
  expect(calls).toContainEqual(['rename', 'Climax']);
  expect(calls).toContainEqual(['duration', 4.5]);
  expect(elements.deleteButton.emit('click')).toBe(true);
  expect(elements.easingIcon.emit('click')).toBe(true);
  expect(elements.seam.emit('click')).toBe(true);
  expect(calls).toContain('delete');
  expect(calls).toContainEqual(['easing', elements.easingIcon]);
  expect(calls).toContain('insert');
  expect(calls.some(call => Array.isArray(call) && call[0] === 'register')).toBe(true);
});

test('scene track labels expose focus intent without becoming text editors', async () => {
  const { wireTimelineTrackLabel } = await importAppModule('ui/timeline', 'timeline-track-label.js');
  const listeners = new Map();
  const classes = new Set();
  const label = {
    style: {},
    classList: { add: name => classes.add(name) },
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  let focused = 0;
  wireTimelineTrackLabel({
    label, isScene: true, focused: true, fallbackName: 'Background', currentName: null,
    onFocus: () => { focused += 1; }, onRename: () => {},
  });
  expect(classes.has('focused')).toBe(true);
  expect(label.style.cursor).toBe('pointer');
  listeners.get('click')();
  expect(focused).toBe(1);
});

test('modern timeline transport presents canonical play, reset, and loop state', async () => {
  const { createTimelineTransport } = await importAppModule('ui/timeline', 'timeline-transport.js');
  const makeButton = () => ({
    listeners: new Map(),
    classes: new Set(),
    attributes: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    click() { this.listeners.get('click')?.({}); },
    classList: {
      toggle() {},
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
  });
  const playButton = makeButton();
  const resetButton = makeButton();
  const loopButton = makeButton();
  loopButton.classList.toggle = (name, enabled) => enabled
    ? loopButton.classes.add(name)
    : loopButton.classes.delete(name);
  const playIcon = { src: '' };
  const calls = [];
  let playing = false;
  let looping = true;
  createTimelineTransport({
    playButton,
    resetButton,
    loopButton,
    playIcon,
    getPlaying: () => playing,
    startPlayback: () => { calls.push('start'); playing = true; return true; },
    stopPlayback: () => { calls.push('stop'); playing = false; },
    resetPlayback: () => { calls.push('reset'); playing = false; },
    getLoop: () => looping,
    setLoop: value => { looping = value; },
    onLoopChange: () => calls.push('loop-change'),
    legacyTransport: { setLoop: value => calls.push(['legacy-loop', value]) },
    setPressed: (button, value) => button.setAttribute('aria-pressed', String(value)),
    beforePlayToggle: () => calls.push('before'),
  });

  expect(playIcon.src).toBe('icons/play.svg');
  expect(loopButton.classes.has('on')).toBe(true);
  playButton.click();
  expect(playIcon.src).toBe('icons/pause.svg');
  playButton.click();
  expect(playIcon.src).toBe('icons/play.svg');
  resetButton.click();
  loopButton.click();
  expect(looping).toBe(false);
  expect(loopButton.attributes.get('aria-pressed')).toBe('false');
  expect(calls).toEqual([
    ['legacy-loop', true], 'before', 'start', 'before', 'stop', 'reset',
    ['legacy-loop', false], 'loop-change',
  ]);
});

test('animation track selector separates frequent syncs from structural rebuilds', async () => {
  const { createAnimationTrackSelector } = await importAppModule('ui/timeline', 'animation-track-selector.js');
  class FakeElement {
    constructor() {
      this.children = [];
      this.listeners = new Map();
      this.style = {};
      this.classes = new Set();
      this.classList = {
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    append(...children) { this.children.push(...children); }
    before(element) { this.beforeElement = element; }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    click() { this.listeners.get('click')?.(); }
  }
  const anchor = new FakeElement();
  const layers = [{ name: 'Base', anim: true }, { name: null, anim: false }];
  let activeIndex = 0;
  let sceneEnabled = true;
  let selectionChanges = 0;
  let structuralChanges = 0;
  const selector = createAnimationTrackSelector({
    documentLike: { createElement: () => new FakeElement() },
    anchor,
    getLayers: () => layers,
    getActiveIndex: () => activeIndex,
    setActiveIndex: index => { activeIndex = index; },
    getSceneEnabled: () => sceneEnabled,
    setSceneEnabled: enabled => { sceneEnabled = enabled; },
    toggleEnabled: enabled => enabled === false,
    onSelectionChange: () => { selectionChanges += 1; },
    onLayerCountChange: () => { structuralChanges += 1; },
    setPressed: (element, enabled) => { element.pressed = enabled; },
  });
  const [previous, title, next, toggle] = anchor.beforeElement.children;

  selector.sync();
  expect(title.textContent).toBe('Base — 1/2');
  expect(toggle.textContent).toBe('On');

  previous.click();
  expect(activeIndex).toBe(2);
  expect(title.textContent).toBe('Scene');
  expect(selectionChanges).toBe(1);
  toggle.click();
  expect(sceneEnabled).toBe(false);
  expect(toggle.textContent).toBe('Off');

  selector.syncLayers();
  selector.syncLayers();
  expect(structuralChanges).toBe(0);
  layers.push({ name: 'Accent', anim: true });
  selector.syncLayers();
  expect(structuralChanges).toBe(1);
  // The selected numeric track is stable when a layer is inserted before the
  // scene track, matching the editor's existing index-based behavior.
  expect(title.textContent).toBe('Accent — 3/3');
  next.click();
  expect(activeIndex).toBe(3);
  expect(title.textContent).toBe('Scene');
});

test('timeline render model maps layer and scene state onto one shared axis', async () => {
  const {
    buildTimelineRenderModel,
    timelineSegmentTint,
  } = await importAppModule('ui/timeline', 'timeline-render-model.js');
  const edited = { duration: 2, snapshot: { colour: '#112233' }, ease: 'linear' };
  const second = { duration: 3, snapshot: { colour: '#445566' }, name: 'Peak' };
  const layer = { name: 'Glow', anim: false, timeline: [edited, second] };
  const scenePhase = { duration: 4, snapshot: { bgColor: '#000000' } };
  const tintCalls = [];
  const model = buildTimelineRenderModel({
    layers: [layer],
    sceneTimeline: [scenePhase],
    sceneEnabled: true,
    activeTrackIndex: 1,
    editingPhase: edited,
    axisSeconds: 10,
    easingLabels: { linear: 'Linear', smootherstep: 'Smooth' },
    tintPhase: (phase, isScene, index) => {
      tintCalls.push([phase, isScene, index]);
      return isScene ? 'scene-tint' : `layer-tint-${index}`;
    },
  });

  expect(model.tracks).toHaveLength(2);
  expect(model.tracks[0]).toMatchObject({
    index: 0, label: 'Glow', isScene: false, enabled: false, focused: false,
  });
  expect(model.tracks[1]).toMatchObject({
    index: 1, label: 'Background', isScene: true, enabled: true, focused: true,
  });
  expect(model.tracks[0].phases[0]).toMatchObject({
    phase: edited,
    phaseIndex: 0,
    shownName: 'Starting',
    easing: 'linear',
    easingTitle: 'Easing: Linear — click to change',
    editing: true,
    tint: 'layer-tint-0',
    leftPercent: 0,
    widthPercent: 20,
  });
  expect(model.tracks[0].phases[1]).toMatchObject({
    shownName: 'Peak', easing: 'smootherstep', leftPercent: 20, widthPercent: 30,
  });
  expect(model.tracks[1].phases[0].tint).toBe('scene-tint');
  expect(tintCalls).toHaveLength(3);
  expect(timelineSegmentTint({ snapshot: null }, false, 0)).toBe('rgba(20,22,28,0.08)');
  expect(timelineSegmentTint({ snapshot: {} }, false, 1)).toBe('#e9f2ff');
});

test('timeline render assembler composes rows while leaving mutations in action adapters', async () => {
  const { assembleTimelineTracks } = await importAppModule('ui/timeline', 'timeline-render-assembler.js');
  const node = () => ({
    children: [],
    classList: { add() {} },
    appendChild(child) { this.children.push(child); },
  });
  const lane = node();
  const track = node();
  const viewport = node();
  const rows = { labelsRow: node(), durationsRow: node(), bracketsRow: node(), segmentsRow: node() };
  const phase = { duration: 4 };
  const calls = [];
  const assembled = assembleTimelineTracks({
    documentLike: {},
    windowLike: {},
    renderModel: { tracks: [{
      index: 0, isScene: false, layer: { name: 'Main' }, timeline: [phase],
      label: 'Main', focused: true, enabled: true,
      phases: [{
        phase, phaseIndex: 0, widthPercent: 20, leftPercent: 0,
        midpointPercent: 10, startSeconds: 0, shownName: 'Starting',
        easingTitle: 'Linear', editing: false, tint: '#fff', hasSeam: false,
      }],
    }] },
    laneWidth: 400,
    thumbnailsEnabled: true,
    tracksElement: { appendChild: value => calls.push(['append-track', value]) },
    actions: {
      phaseActions: () => ({ select() {}, delete() {}, rename() {}, setDuration() {}, insertAfter() {} }),
      trackActions: () => ({ focus() {}, rename() {}, toggle() {} }),
    },
    selection: {},
    gestures: {
      wasLaneDrag: () => false,
      wireLaneScrub: value => calls.push(['scrub', value]),
    },
    lanes: { registerViewport: value => calls.push(['viewport', value]) },
    wireResize() {},
    openEasingMenu() {},
    trackFactory: () => ({
      track, label: node(), lane, viewport, toggleWrapper: node(), ...rows,
    }),
    phaseFactory: () => ({
      segment: node(), swatch: node(), resizeLeft: node(), resizeRight: node(),
      deleteButton: node(), name: node(), bracket: node(), bracketLeft: node(),
      bracketRight: node(), durationElement: node(), durationText: node(),
      easingIcon: node(), seam: null,
    }),
    toggleFactory: () => node(),
    wirePhase: options => calls.push(['phase', options.phase]),
    wireTrack: options => calls.push(['track', options.currentName]),
  });

  expect(assembled.referenceLane).toBe(lane);
  expect(assembled.pendingThumbnailSegments).toHaveLength(1);
  expect(lane._timeline).toEqual([phase]);
  expect(lane._segs).toHaveLength(1);
  expect(rows.segmentsRow.children).toHaveLength(1);
  expect(calls).toContainEqual(['phase', phase]);
  expect(calls).toContainEqual(['track', 'Main']);
  expect(calls).toContainEqual(['append-track', track]);
});

test('timeline renderer runs reset, model, assembly, and finalization in order', async () => {
  const { createTimelineRenderer } = await importAppModule('ui/timeline', 'timeline-renderer.js');
  const calls = [];
  const tracksElement = { clientWidth: 900, innerHTML: 'old' };
  const renderModel = { tracks: [] };
  const renderer = createTimelineRenderer({
    documentLike: {},
    windowLike: {},
    tracksElement,
    isOpen: () => true,
    getLayers: () => [{ timeline: [] }],
    sceneTimeline: [],
    getSceneEnabled: () => true,
    getActiveTrackIndex: () => 0,
    getEditingPhase: () => null,
    getTimelines: () => [[], []],
    getTrackCount: () => 2,
    getMaximumDuration: () => 12,
    easingLabels: {},
    minimumAxisSeconds: 20,
    pixelsPerSecond: 34,
    gutterWidth: 180,
    thumbnailPreview: { hide: () => calls.push('hide') },
    getThumbnailCaptures: () => ({ resetTrackCount: count => calls.push(['tracks', count]) }),
    thumbnailStrip: {},
    lanes: { reset: () => { calls.push('reset'); return { top: 2, left: 3 }; } },
    selection: { reset: () => calls.push('selection') },
    gestures: {},
    actions: {},
    wireResize() {},
    openEasingMenu() {},
    updatePlayhead() {},
    calculateAxis: options => {
      calls.push(['axis', options.maxDuration, options.containerWidth]);
      return { axisSeconds: 20, laneWidth: 680 };
    },
    buildModel: options => { calls.push(['model', options.axisSeconds]); return renderModel; },
    assemble: options => {
      calls.push(['assemble', options.renderModel]);
      return { pendingThumbnailSegments: ['pending'], referenceLane: 'lane' };
    },
    finalize: options => calls.push(['finalize', options.referenceLane, options.preservedScroll]),
  });

  expect(renderer.render()).toBe(true);
  expect(tracksElement.innerHTML).toBe('');
  expect(calls).toEqual([
    'hide', 'reset', 'selection', ['tracks', 2], ['axis', 12, 900],
    ['model', 20], ['assemble', renderModel], ['finalize', 'lane', { top: 2, left: 3 }],
  ]);
});

test('timeline render finalizer establishes global geometry after row insertion', async () => {
  const { finalizeTimelineRender } = await importAppModule('ui/timeline', 'timeline-render-finalizer.js');
  const calls = [];
  const referenceLane = { id: 'lane' };
  const summaryViewport = { id: 'summary' };
  const wireLaneScrub = () => {};
  const syncScroll = () => {};
  const timelineLanes = {
    syncScroll,
    setAxis: value => calls.push(['axis', value]),
    createOverlay: () => calls.push(['overlay']),
    registerViewport: (...args) => calls.push(['viewport', ...args]),
    cacheGeometry: () => calls.push(['cache']),
    restoreScroll: value => calls.push(['restore', value]),
  };
  const thumbnailStrip = {
    fillSegments: value => calls.push(['fill', value]),
    buildSummary: value => { calls.push(['summary', value]); return summaryViewport; },
  };
  const segments = [{ id: 'segment' }];
  const timelines = [[], [{ duration: 2 }]];
  const preservedScroll = { top: 12, left: 34 };
  finalizeTimelineRender({
    timelineLanes,
    thumbnailStrip,
    timelineGestures: { wireLaneScrub },
    tracksElement: { id: 'tracks' },
    timelines,
    pendingThumbnailSegments: segments,
    referenceLane,
    maxDuration: 8,
    axisSeconds: 20,
    laneWidth: 680,
    thumbnailsEnabled: true,
    preservedScroll,
    updatePlayhead: () => calls.push(['playhead']),
  });

  expect(calls[0]).toEqual(['axis', { lane: referenceLane, duration: 8, visibleSeconds: 20 }]);
  expect(calls[1]).toEqual(['overlay']);
  expect(calls.find(call => call[0] === 'fill')[1].timeScaleSeconds).toBe(8);
  const summary = calls.find(call => call[0] === 'summary')[1];
  expect(summary.referenceTimeline).toBe(timelines[1]);
  expect(summary.onScrub).toBe(wireLaneScrub);
  expect(summary.onScroll).toBe(syncScroll);
  expect(calls.slice(-3)).toEqual([['cache'], ['restore', preservedScroll], ['playhead']]);
});

test('timeline render actions coordinate shared columns and track state', async () => {
  const { createTimelineRenderActions } = await importAppModule('ui/timeline', 'timeline-render-actions.js');
  const phase = { duration: 4, snapshot: { params: { count: 10 } } };
  const otherPhase = { duration: 5, snapshot: { params: { count: 20 } } };
  const timelines = [[phase], [otherPhase]];
  let editingPhase = phase;
  let activeTrack = 0;
  let sceneEnabled = true;
  let dirtyCount = 0;
  let renderCount = 0;
  const calls = [];
  const focusedA = { classList: { remove: name => calls.push(['remove-class', name]) } };
  const focusedB = { classList: { remove: name => calls.push(['remove-class', name]) } };
  const label = { classList: { add: name => calls.push(['add-class', name]) } };
  const layer = { name: 'Old', anim: true };
  const coordinator = createTimelineRenderActions({
    getTimelines: () => timelines,
    getEditingPhase: () => editingPhase,
    clearEditingPhase: () => { editingPhase = null; calls.push(['clear-editing']); },
    setEditingPhase: value => { editingPhase = value; },
    setActiveTrack: value => { activeTrack = value; },
    applyTrackSnapshot: value => calls.push(['apply', value]),
    captureTrackSnapshot: () => ({ params: { count: 99 } }),
    cloneSnapshot: value => value ? structuredClone(value) : null,
    captureSnapshotForTrack: index => ({ params: { count: index } }),
    markDirty: () => { dirtyCount += 1; },
    render: () => { renderCount += 1; },
    tracksElement: { querySelectorAll: () => [focusedA, focusedB] },
    syncParameters: () => calls.push(['sync-params']),
    syncLegacyLayers: () => calls.push(['sync-legacy']),
    getSceneEnabled: () => sceneEnabled,
    setSceneEnabled: value => { sceneEnabled = value; },
  });

  const phaseActions = coordinator.phaseActions({ phase, phaseIndex: 0, trackIndex: 1 });
  phaseActions.select();
  expect(activeTrack).toBe(1);
  expect(calls).toContainEqual(['apply', phase.snapshot]);
  phaseActions.rename('Intro');
  expect(timelines.map(timeline => timeline[0].name)).toEqual(['Intro', 'Intro']);
  phaseActions.setDuration(3);
  expect(phase.duration).toBe(3);
  phaseActions.insertAfter();
  expect(timelines.map(timeline => timeline.length)).toEqual([2, 2]);
  expect(timelines[0][1].snapshot).not.toBe(phase.snapshot);
  phaseActions.delete();
  expect(timelines.map(timeline => timeline.length)).toEqual([1, 1]);
  expect(editingPhase).toBe(null);

  const layerActions = coordinator.trackActions({ trackIndex: 0, isScene: false, layer, label });
  layerActions.focus();
  expect(activeTrack).toBe(0);
  expect(calls).toContainEqual(['add-class', 'focused']);
  layerActions.rename('Renamed');
  expect(layer.name).toBe('Renamed');
  layerActions.toggle();
  expect(layer.anim).toBe(false);

  const sceneActions = coordinator.trackActions({ trackIndex: 1, isScene: true, layer: null, label });
  sceneActions.toggle();
  expect(sceneEnabled).toBe(false);
  expect(dirtyCount).toBe(7);
  expect(renderCount).toBe(8);
});
