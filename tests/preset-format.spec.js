const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const formatModule = import(pathToFileURL(path.join(
  __dirname,
  '..',
  'app',
  'presets',
  'preset-format.js',
)).href);

test('preset parser recognizes current and legacy section formats', async () => {
  const { parsePresetDocument } = await formatModule;
  const current = parsePresetDocument([
    'Firefly Layer 2',
    'name Accent',
    '@calm #123456',
    'Anim Layer 2',
    'Phase 1 @ 0',
    'ease easeInOut',
    'count 42.500',
    'View',
    'emotion SAD',
    'presetname Café – 感情 🌊',
  ].join('\n'));

  expect(current.hasFireflyLayers).toBe(true);
  expect(current.tokens).toContainEqual({ type: 'section', section: 'firefly', index: 1 });
  expect(current.tokens).toContainEqual({ type: 'phase', duration: 5 });
  expect(current.tokens).toContainEqual({ type: 'emotion', value: 'sad' });
  expect(current.tokens).toContainEqual({ type: 'presetName', value: 'Café – 感情 🌊' });

  const legacy = parsePresetDocument('Firefly Field\ncount 20\nToggles\nglow 1');
  expect(legacy.hasFireflyLayers).toBe(false);
  expect(legacy.tokens[0]).toEqual({ type: 'section', section: 'firefly', index: 0, legacy: true });
  expect(legacy.tokens).toContainEqual({ type: 'section', section: 'view' });
});

test('preset serializer emits the stable text format', async () => {
  const { parsePresetDocument, serializePresetDocument } = await formatModule;
  const text = serializePresetDocument({
    fireflySliderDefs: [['count', 1], ['speed', 0.01]],
    fireflyLayers: [{
      name: 'Main',
      params: { count: 20, speed: 1.25 },
      overrides: { calm: '#123456' },
      anim: true,
      timeline: [{
        duration: 2,
        ease: 'smooth',
        snapshot: { params: { count: 30 }, colour: '#abcdef' },
      }],
    }],
    classicSliderDefs: [['trail', 0.01]],
    classic: { trail: 0.5 },
    scene: { anim: false, timeline: [] },
    view: {
      emotion: 'calm', mode: 'circles', loop: true, glow: false, fireflies: true,
      glowColor: '#ffffff', glowOpacity: 0.5, bgColor: '#000000', bgColor2: '#111111',
      bgGradientAmount: 0.25, rotate: false, rotateSpeed: 0.1, presetName: 'Stable',
    },
  });

  expect(text).toContain('count 20');
  expect(text).toContain('speed 1.25');
  expect(text).toContain('count 30.000');
  expect(text).toContain('Anim Scene\nanimate 0');
  expect(text).toContain('presetname Stable');
  expect(parsePresetDocument(text).hasFireflyLayers).toBe(true);
});
