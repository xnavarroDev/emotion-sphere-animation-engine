const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Timeline math, playback state, interpolation, and snapshot policies.

test('timeline helpers select phases and preserve easing behavior', async () => {
  const {
    EASINGS,
    getTrackDuration,
    getTrackSequence,
    interpolateTrack,
  } = await importAppModule('animation', 'timeline.js');
  const empty = { value: 0 };
  const first = { value: 10 };
  const second = { value: 20 };
  const timeline = [
    { duration: 1, ease: 'linear', snapshot: first },
    { duration: 2, ease: 'linear', snapshot: second },
    { duration: 3, snapshot: null },
  ];
  const sequence = getTrackSequence(timeline);

  expect(sequence).toHaveLength(2);
  expect(getTrackDuration(sequence)).toBe(3);

  let sample;
  interpolateTrack(sequence, 0.5, (from, to, fraction) => { sample = { from, to, fraction }; }, empty);
  expect(sample).toEqual({ from: empty, to: first, fraction: 0.5 });

  interpolateTrack(sequence, 2, (from, to, fraction) => { sample = { from, to, fraction }; }, empty);
  expect(sample).toEqual({ from: first, to: second, fraction: 0.5 });
  expect(EASINGS.backout(0.8)).toBeGreaterThan(1);
});

test('playback planner applies one eligibility rule and master duration', async () => {
  const {
    advanceTimelinePlayback, buildTimelinePlaybackPlan,
  } = await importAppModule('animation', 'playback-plan.js');
  const phase = duration => ({ duration, snapshot: { duration } });
  const longest = { anim: true, timeline: [phase(2), phase(4)] };
  const shorter = { anim: true, timeline: [phase(1), phase(2)] };
  const disabled = { anim: false, timeline: [phase(20), phase(20)] };
  const incomplete = { anim: true, timeline: [phase(50)] };
  const sceneTimeline = [phase(3), phase(5)];

  const plan = buildTimelinePlaybackPlan({
    layers: [longest, shorter, disabled, incomplete],
    sceneTimeline,
    sceneEnabled: true,
  });
  expect(plan.tracks.map(track => track.F)).toEqual([longest, shorter]);
  expect(plan.tracks.map(track => track.total)).toEqual([6, 3]);
  expect(plan.sceneTotal).toBe(8);
  expect(plan.maxTotal).toBe(8);

  const empty = buildTimelinePlaybackPlan({
    layers: [disabled, incomplete], sceneTimeline, sceneEnabled: false,
  });
  expect(empty).toEqual({ tracks: [], sceneSequence: null, sceneTotal: 0, maxTotal: 0 });

  const respawns = [];
  longest.params = { spawnSpan: 10 };
  longest.respawn = duration => respawns.push(duration);
  longest.timeline[0].snapshot.params = { count: 1, size: 4 };
  longest.timeline[1].snapshot.params = { count: 100, size: 8 };
  const layerSamples = [];
  const sceneSamples = [];
  const wrapped = advanceTimelinePlayback({
    deltaTime: 0.2, scrubbing: false, time: 7.9, previousGlobalTime: 7.9,
    loop: true, plan,
    applyLayer: sample => layerSamples.push(sample),
    applyScene: sample => sceneSamples.push(sample),
  });
  expect(wrapped.sampleTime).toBeCloseTo(0.1);
  expect(wrapped.previousGlobalTime).toBeCloseTo(0.1);
  expect(respawns).toEqual([6]);
  expect(layerSamples[0].zeroSnapshot.params).toEqual({ count: 0, size: 4 });
  expect(sceneSamples[0].time).toBeCloseTo(0.1);

  const finished = advanceTimelinePlayback({
    deltaTime: 2, scrubbing: false, time: 7, previousGlobalTime: 0,
    loop: false, plan,
    applyLayer: () => {}, applyScene: () => {},
  });
  expect(finished.finished).toBe(true);
  expect(finished.time).toBe(8);
  expect(finished.sampleTime).toBe(8);
});

test('timeline frame runner owns tick ordering and playback stop policy', async () => {
  const { createTimelineFrameRunner } = await importAppModule('animation', 'frame-runner.js');
  const calls = [];
  let ready = false;
  const playback = {
    time: 3,
    previousGlobalTime: 2,
    hasPlayback: true,
    finished: true,
    sampleTime: 3,
    maxTotal: 4,
  };
  const runner = createTimelineFrameRunner({
    isReady: () => ready,
    getPlaying: () => true,
    getScrubbing: () => false,
    getTime: () => 2,
    getPreviousTime: () => 1,
    getLoop: () => false,
    getLayers: () => ['layer'],
    sceneTimeline: ['scene'],
    getSceneEnabled: () => true,
    applyLayer() {},
    applyScene() {},
    setClock: (...values) => calls.push(['clock', ...values]),
    stopPlayback: () => calls.push('stop'),
    onFrame: value => calls.push(['frame', value.sampleTime]),
    buildPlan: options => { calls.push(['plan', options.layers]); return { maxTotal: 4 }; },
    advance: options => { calls.push(['advance', options.deltaTime]); return playback; },
  });

  expect(runner.run(0.1)).toBeNull();
  ready = true;
  expect(runner.run(0.1)).toBe(playback);
  expect(calls).toEqual([
    ['plan', ['layer']],
    ['advance', 0.1],
    ['clock', 3, 2],
    ['frame', 3],
    'stop',
  ]);
});

test('playback state keeps clock, scrubbing, and capture restoration coherent', async () => {
  const { createPlaybackState } = await importAppModule('animation', 'playback-state.js');
  const state = createPlaybackState({ loop: false });

  expect(state).toMatchObject({
    playing: false,
    time: 0,
    previousGlobalTime: 0,
    loop: false,
    seekHold: null,
    scrubbing: false,
  });

  state.previousGlobalTime = 2;
  state.seekHold = 3;
  state.beginScrub(4);
  expect(state).toMatchObject({ time: 4, scrubbing: true });

  const captured = state.capture();
  state.time = 9;
  state.loop = true;
  state.restoreCapture(captured);
  expect(state).toMatchObject({ time: 4, loop: false, scrubbing: false });

  state.resetClock();
  expect(state).toMatchObject({ time: 0, previousGlobalTime: 0, seekHold: null });
});

test('firefly snapshot transition skips spawn-reset parameters and owns phase color', async () => {
  const { applyFireflySnapshotTransition } = await importAppModule('animation', 'firefly-transition.js');
  const calls = [];
  const field = {
    setParams: value => calls.push(['params', value]),
    setColor: value => calls.push(['color', value]),
    _phaseColourActive: false,
  };
  const parameters = applyFireflySnapshotTransition(
    field,
    { params: { count: 1, speed: 2, coreBias: 0.5, spawnSpan: 1, mode: 'a' }, colour: '#000000' },
    { params: { count: 4, speed: 6, coreBias: 2, spawnSpan: 8, mode: 'b' }, colour: '#ffffff' },
    0.5,
  );
  expect(parameters).toEqual({ count: 3, speed: 4 });
  expect(calls).toEqual([
    ['params', { count: 3, speed: 4 }],
    ['color', '#808080'],
  ]);
  expect(field._phaseColourActive).toBe(true);
});

test('scene snapshot transition interpolates values through explicit adapters', async () => {
  const { applySceneSnapshotTransition } = await importAppModule('animation', 'scene-transition.js');
  const classic = { life: 1, mode: 'keep' };
  const calls = [];
  const applied = applySceneSnapshotTransition(
    {
      classic: { life: 2, mode: 'a' }, glowOpacity: 0.2, glowColor: '#000000',
      bgColor: '#000000', bgColor2: '#ffffff', bgGradientAmount: 0,
    },
    {
      classic: { life: 6, mode: 'b' }, glowOpacity: 0.8, glowColor: '#ffffff',
      bgColor: '#ffffff', bgColor2: '#000000', bgGradientAmount: 1,
    },
    0.25,
    {
      classic,
      onClassicChange: value => calls.push(['classic', value.life]),
      onGlowOpacity: value => calls.push(['opacity', value]),
      onGlowColor: value => calls.push(['glow', value]),
      onBackgroundColor: value => calls.push(['background', value]),
      onSecondaryBackgroundColor: value => calls.push(['secondary', value]),
      onGradientAmount: value => calls.push(['gradient', value]),
      onBackgroundSync: () => calls.push(['sync']),
    },
  );
  expect(classic).toEqual({ life: 3, mode: 'keep' });
  expect(applied).toMatchObject({
    classic, glowColor: '#404040',
    bgColor: '#404040', bgColor2: '#bfbfbf', bgGradientAmount: 0.25,
  });
  expect(applied.glowOpacity).toBeCloseTo(0.35);
  expect(calls.at(-1)).toEqual(['sync']);
  expect(calls.find(call => call[0] === 'opacity')[1]).toBeCloseTo(0.35);
});

test('scene transition adapters synchronize renderer state without overwriting focused inputs', async () => {
  const { createSceneTransitionAdapters } = await importAppModule('animation', 'scene-transition-adapters.js');
  const opacityInput = { value: 'focused' };
  const colorInput = { value: '' };
  const elements = { 'glow-opacity': opacityInput, 'glow-color': colorInput };
  const documentLike = {
    activeElement: opacityInput,
    getElementById: id => elements[id] ?? null,
  };
  const settings = { glowOpacity: 0, glowColor: '#ffffff' };
  const calls = [];
  const adapters = createSceneTransitionAdapters({
    documentLike,
    classic: { scale: 1 },
    sceneSettings: settings,
    cloud: { setUserTint: (...args) => calls.push(['tint', ...args]) },
    setBackgroundColor: value => calls.push(['primary', value]),
    setSecondaryBackgroundColor: value => calls.push(['secondary', value]),
    setGradientAmount: value => calls.push(['gradient', value]),
    syncClassic: () => calls.push('classic-sync'),
    syncBackground: () => calls.push('background-sync'),
  });

  adapters.onGlowOpacity(0.4);
  adapters.onGlowColor('#123456');
  adapters.onBackgroundColor('#000000');
  adapters.onBackgroundSync();
  expect(settings).toEqual({ glowOpacity: 0.4, glowColor: '#123456' });
  expect(opacityInput.value).toBe('focused');
  expect(colorInput.value).toBe('#123456');
  expect(calls).toContainEqual(['tint', null, 0.4]);
  expect(calls).toContainEqual(['primary', '#000000']);
  expect(calls).toContain('background-sync');
});

test('timeline layout helpers produce stable axis and phase geometry', async () => {
  const {
    calculatePhaseSpans,
    calculateTimelineAxis,
    formatTimelineTime,
    timelineTimeFromClientX,
  } = await importAppModule('animation', 'timeline-layout.js');

  expect(formatTimelineTime(65.9)).toBe('1:05');
  expect(formatTimelineTime(-4)).toBe('0:00');
  expect(calculateTimelineAxis({
    maxDuration: 10,
    containerWidth: 1000,
    gutterWidth: 180,
    minimumSeconds: 20,
    pixelsPerSecond: 34,
  })).toEqual({ axisSeconds: 820 / 34, laneWidth: 820 });

  expect(calculatePhaseSpans([{ duration: 5 }, { duration: 10 }], 20)).toEqual([
    { startSeconds: 0, endSeconds: 5, leftPercent: 0, widthPercent: 25, midpointPercent: 12.5 },
    { startSeconds: 5, endSeconds: 15, leftPercent: 25, widthPercent: 50, midpointPercent: 50 },
  ]);
  expect(timelineTimeFromClientX(150, { left: 100, width: 200 }, 20)).toBe(5);
  expect(timelineTimeFromClientX(50, { left: 100, width: 200 }, 20)).toBe(0);
  expect(timelineTimeFromClientX(350, { left: 100, width: 200 }, 20)).toBe(20);
  expect(timelineTimeFromClientX(100, { left: 100, width: 0 }, 20)).toBeNull();
});

test('timeline seek clamps empty axis space and synchronizes visible births', async () => {
  const { seekTimelineFromClientX } = await importAppModule('animation', 'timeline-seek.js');
  const calls = [];
  const active = {
    timeline: [{}, {}],
    anim: true,
    params: { spawnSpan: 9 },
    setSpawnAge: (...args) => calls.push(['spawn', ...args]),
    snapCount: () => calls.push(['snap-active']),
  };
  const disabled = {
    timeline: [{}, {}],
    anim: false,
    params: { spawnSpan: 4 },
    setSpawnAge: () => calls.push(['unexpected-spawn']),
    snapCount: () => calls.push(['snap-disabled']),
  };
  const time = seekTimelineFromClientX({
    clientX: 250,
    laneRect: { left: 50, width: 200 },
    axisSeconds: 20,
    maximumDuration: 12,
    layers: [active, disabled],
    getSequence: timeline => timeline,
    getDuration: () => 6,
    sample: value => calls.push(['sample', value]),
  });

  expect(time).toBe(12);
  expect(calls).toEqual([
    ['sample', 12],
    ['spawn', 12, 6],
    ['snap-active'],
    ['snap-disabled'],
  ]);
  expect(seekTimelineFromClientX({
    clientX: 10,
    laneRect: { left: 0, width: 0 },
    axisSeconds: 20,
    maximumDuration: 12,
    layers: [],
    getSequence: timeline => timeline,
    getDuration: () => 0,
    sample: () => { throw new Error('invalid lanes must not sample'); },
  })).toBeNull();
});

test('phase insertion keeps every timeline on the same structural branch', async () => {
  const { insertPhaseSpan } = await importAppModule('animation', 'timeline-edit.js');
  const timelines = [
    [{ duration: 10, ease: 'linear', snapshot: { track: 0 } }],
    [{ duration: 8, ease: 'smooth', snapshot: { track: 1 } }],
  ];
  const cloneSnapshot = snapshot => snapshot ? { ...snapshot } : null;
  const focused = insertPhaseSpan({
    timelines,
    startSeconds: 4,
    endSeconds: 6,
    focusedTrackIndex: 1,
    cloneSnapshot,
    captureSnapshot: track => ({ fallback: track }),
  });

  expect(timelines.map(timeline => timeline.length)).toEqual([3, 3]);
  expect(timelines[0].map(phase => phase.duration)).toEqual([4, 2, 6]);
  expect(timelines[1].map(phase => phase.duration)).toEqual([3.2, 2, 4.8]);
  expect(focused).toBe(timelines[1][1]);
  expect(focused.snapshot).toEqual({ track: 1 });
  expect(focused.snapshot).not.toBe(timelines[1][0].snapshot);
});

test('timeline structural actions keep phase columns aligned and snapshots isolated', async () => {
  const {
    clearTimeline,
    insertPhaseColumnAfter,
    removePhaseColumn,
    toggleAnimationEnabled,
  } = await importAppModule('animation', 'timeline-edit.js');
  const timelines = [
    [
      { duration: 8, snapshot: { track: 0, phase: 0 } },
      { duration: 6, snapshot: { track: 0, phase: 1 } },
    ],
    [{ duration: 10, snapshot: { track: 1, phase: 0 } }],
  ];

  const inserted = insertPhaseColumnAfter({
    timelines,
    phaseIndex: 0,
    fallbackDuration: 8,
    cloneSnapshot: snapshot => snapshot ? { ...snapshot } : null,
    captureSnapshot: trackIndex => ({ capturedFor: trackIndex }),
  });
  expect(timelines.map(timeline => timeline.length)).toEqual([3, 2]);
  expect(inserted.map(phase => phase.duration)).toEqual([4, 5]);
  expect(inserted[0].snapshot).toEqual({ track: 0, phase: 0 });
  expect(inserted[0].snapshot).not.toBe(timelines[0][0].snapshot);

  const removed = removePhaseColumn(timelines, 1);
  expect(removed).toEqual(inserted);
  expect(timelines.map(timeline => timeline.length)).toEqual([2, 1]);
  expect(removePhaseColumn(timelines, -1)).toEqual([]);

  expect(toggleAnimationEnabled(undefined)).toBe(false);
  expect(toggleAnimationEnabled(false)).toBe(true);
  expect(clearTimeline(timelines[0])).toHaveLength(2);
  expect(timelines[0]).toEqual([]);
});

test('default timeline helpers clone snapshots and seed only implicit empty state', async () => {
  const {
    cloneTimelineSnapshot,
    seedDefaultTimelines,
    shouldSeedDefaultTimelines,
  } = await importAppModule('animation', 'default-timeline.js');
  const source = {
    params: { count: 100, radius: 2, breath: 0.1 },
    classic: { life: 4 },
    colour: '#123456',
    glowOpacity: 0,
    bgGradientAmount: 0,
  };
  const clone = cloneTimelineSnapshot(source);
  clone.params.count = 1;
  clone.classic.life = 9;
  expect(source.params.count).toBe(100);
  expect(source.classic.life).toBe(4);
  expect(clone.glowOpacity).toBe(0);
  expect(clone.bgGradientAmount).toBe(0);

  const timelines = [[], []];
  seedDefaultTimelines({
    timelines,
    captureSnapshot: index => index === 0
      ? cloneTimelineSnapshot(source)
      : { classic: { life: 4 }, bgColor: '#000000' },
  });
  expect(timelines[0].map(phase => phase.duration)).toEqual([6, 6, 6]);
  expect(timelines[0][1].snapshot.params).toEqual({ count: 135, radius: 2.24, breath: 0.25 });
  expect(timelines[0][0].snapshot.params.count).toBe(100);
  expect(timelines[0][2].snapshot).not.toBe(timelines[0][0].snapshot);
  expect(timelines[1][1].snapshot).toEqual(timelines[1][0].snapshot);

  expect(shouldSeedDefaultTimelines({ search: '', layerCount: 2, timelines: [[], []] })).toBe(true);
  expect(shouldSeedDefaultTimelines({ search: '?emotion=calm', layerCount: 2, timelines: [[], []] })).toBe(false);
  expect(shouldSeedDefaultTimelines({ search: '?preset=abc', layerCount: 2, timelines: [[], []] })).toBe(false);
  expect(shouldSeedDefaultTimelines({ search: '', layerCount: 0, timelines: [[], []] })).toBe(false);
  expect(shouldSeedDefaultTimelines({ search: '', layerCount: 2, timelines: [[{}], []] })).toBe(false);
});

test('default timeline seeder is safe across competing readiness paths', async () => {
  const { createDefaultTimelineSeeder } = await importAppModule('animation', 'default-timeline-seeder.js');
  const timelines = [[], []];
  let renders = 0;
  let captures = 0;
  const seeder = createDefaultTimelineSeeder({
    search: '',
    getLayerCount: () => 1,
    getTimelines: () => timelines,
    captureSnapshot: index => index === 0
      ? { params: { count: 10 }, colour: '#123456' }
      : { classic: { life: 3 } },
    render: () => { renders += 1; },
    captureDefault: () => { captures += 1; },
  });

  expect(seeder.seedIfEligible()).toBe(true);
  expect(timelines.map(timeline => timeline.length)).toEqual([3, 3]);
  expect(renders).toBe(1);
  expect(captures).toBe(1);
  expect(seeder.seedIfEligible()).toBe(false);
  expect(renders).toBe(1);
  expect(captures).toBe(1);
});

test('timeline workspace keeps track focus, lookup, and snapshots consistent', async () => {
  const { createTimelineWorkspace } = await importAppModule('animation', 'timeline-workspace.js');
  const firstTimeline = [{ duration: 2 }];
  const secondTimeline = [{ duration: 4 }];
  const sceneTimeline = [{ duration: 6 }];
  const layers = [
    { timeline: firstTimeline, params: { count: 10 }, color: () => [1, 2, 3] },
    { timeline: secondTimeline, params: { count: 20 }, color: () => [4, 5, 6] },
  ];
  const classicState = { life: 8 };
  const sceneSettings = {
    glowOpacity: 0.4,
    glowColor: '#abcdef',
    backgroundColor: '#111111',
    secondaryBackgroundColor: '#222222',
    gradientAmount: 0.75,
  };
  const workspace = createTimelineWorkspace({
    getLayers: () => layers,
    sceneTimeline,
    classicState,
    sceneSettings,
    colorToHex: color => color.join('-'),
  });

  expect(workspace.activeTrackIndex).toBe(0);
  expect(workspace.getActiveTimeline()).toBe(firstTimeline);
  expect(workspace.getAllTimelines()).toEqual([firstTimeline, secondTimeline, sceneTimeline]);
  const layerSnapshot = workspace.captureActiveSnapshot();
  expect(layerSnapshot).toEqual({ params: { count: 10 }, colour: '1-2-3' });
  layers[0].params.count = 99;
  expect(layerSnapshot.params.count).toBe(10);

  workspace.setActiveTrack(2);
  expect(workspace.isSceneTrack()).toBe(true);
  expect(workspace.getActiveTimeline()).toBe(sceneTimeline);
  const sceneSnapshot = workspace.captureActiveSnapshot();
  expect(sceneSnapshot).toEqual({
    classic: { life: 8 },
    glowOpacity: 0.4,
    glowColor: '#abcdef',
    bgColor: '#111111',
    bgColor2: '#222222',
    bgGradientAmount: 0.75,
  });
  classicState.life = 2;
  expect(sceneSnapshot.classic.life).toBe(8);

  // Layer lookups stay current when collection size changes at runtime.
  layers.push({ timeline: [], params: {}, color: () => [7, 8, 9] });
  expect(workspace.isSceneTrack()).toBe(false);
  expect(workspace.getActiveTimeline()).toBe(layers[2].timeline);
});

test('track snapshot editor applies exact scene and layer values through adapters', async () => {
  const { applyTrackSnapshotToEditor } = await importAppModule('animation', 'track-snapshot.js');
  const calls = [];
  const classicState = { life: 4 };
  const common = {
    stopPlayback: () => calls.push(['stop']),
    classicState,
    setGlowOpacity: value => calls.push(['glow-opacity', value]),
    setGlowColor: value => calls.push(['glow-color', value]),
    setBackgroundColor: value => calls.push(['background', value]),
    setSecondaryBackgroundColor: value => calls.push(['background-2', value]),
    setGradientAmount: value => calls.push(['gradient', value]),
    syncClassic: () => calls.push(['sync-classic']),
    syncBackground: () => calls.push(['sync-background']),
    selectLayer: index => calls.push(['select', index]),
    syncLayer: () => calls.push(['sync-layer']),
    onApplied: () => calls.push(['applied']),
  };
  const sceneApplied = applyTrackSnapshotToEditor({
    ...common,
    sceneTrack: true,
    snapshot: {
      classic: { life: 8, futureSetting: 99 },
      glowOpacity: 0,
      glowColor: '#abcdef',
      bgColor: '#111111',
      bgColor2: '#222222',
      bgGradientAmount: 0,
    },
  });
  expect(sceneApplied).toBe(true);
  expect(classicState).toEqual({ life: 8 });
  expect(calls).toContainEqual(['glow-opacity', 0]);
  expect(calls).toContainEqual(['gradient', 0]);
  expect(calls).toContainEqual(['sync-background']);

  calls.length = 0;
  const layer = {
    setParams: value => calls.push(['params', value]),
    setColor: value => calls.push(['color', value]),
  };
  applyTrackSnapshotToEditor({
    ...common,
    sceneTrack: false,
    snapshot: { params: { count: 25 }, colour: '#123456' },
    layer,
    layerIndex: 2,
  });
  expect(calls).toEqual([
    ['stop'], ['params', { count: 25 }], ['color', '#123456'],
    ['select', 2], ['applied'], ['sync-layer'],
  ]);
  expect(applyTrackSnapshotToEditor({ ...common, snapshot: null })).toBe(false);
});

test('playback session restarts eligible births only at zero and restores idle state', async () => {
  const {
    preparePlaybackStart,
    prepareTimelinePlayback,
    restartPlaybackFromBeginning,
    restoreIdleLayerState,
  } = await importAppModule('animation', 'playback-session.js');
  const respawns = [];
  const eligible = {
    params: { spawnSpan: 9 },
    idle: { count: 40, radius: 1.5 },
    respawn: duration => respawns.push(duration),
    setParams(patch) { this.params = { ...this.params, ...patch }; },
  };
  const plan = {
    tracks: [{ F: eligible, total: 6 }],
    sceneSequence: null,
    maxTotal: 6,
  };
  expect(preparePlaybackStart({ time: 0, plan })).toEqual({
    playable: true,
    previousGlobalTime: 0,
  });
  expect(respawns).toEqual([6]);

  expect(preparePlaybackStart({ time: 2, plan })).toEqual({
    playable: true,
    previousGlobalTime: null,
  });
  expect(respawns).toEqual([6]);
  expect(preparePlaybackStart({ time: 0, plan: { tracks: [], maxTotal: 0 } }).playable).toBe(false);

  const plannedLayer = {
    anim: true,
    params: { spawnSpan: 2 },
    timeline: [
      { duration: 1, snapshot: { params: {} } },
      { duration: 2, snapshot: { params: {} } },
    ],
    respawn: duration => respawns.push(duration),
  };
  expect(prepareTimelinePlayback({
    layers: [plannedLayer],
    sceneTimeline: [],
    sceneEnabled: false,
    time: 0,
  })).toEqual({ playable: true, previousGlobalTime: 0 });
  expect(respawns.at(-1)).toBe(2);

  restoreIdleLayerState([eligible, { idle: null, setParams: () => { throw new Error('not idle'); } }]);
  expect(eligible.params).toEqual({ spawnSpan: 9, count: 40, radius: 1.5 });
  eligible.idle.count = 99;
  expect(eligible.params.count).toBe(40);

  respawns.length = 0;
  const restarted = restartPlaybackFromBeginning({
    layers: [eligible, { anim: false, timeline: [{}, {}], params: { spawnSpan: 5 } }],
    getSequence: timeline => timeline || [{}, {}],
    getDuration: () => 6,
  });
  expect(restarted).toEqual({
    time: 0,
    previousGlobalTime: 0,
    seekHold: null,
    playing: true,
  });
  expect(respawns).toEqual([6]);
});
