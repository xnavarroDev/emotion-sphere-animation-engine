const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '../..');
const threePath = require.resolve('three/build/three.min.js');

const emotionDots = {
  calm: '#d-purple',
  sad: '#d-blue',
  warm: '#d-yellow',
  anger: '#d-red',
};

function readPreset(name) {
  return fs.readFileSync(path.join(repoRoot, 'presets', `firefly-${name}.txt`), 'utf8');
}

function encodePreset(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

function decodePresetUrl(url) {
  const encoded = new URL(url).searchParams.get('preset');
  if (!encoded) throw new Error('Shared URL did not contain a preset parameter');
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

function timelineCounts(text) {
  const counts = [];
  let current = -1;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const layer = line.match(/^Anim Layer\s+(\d+)$/i);
    if (layer) {
      current = Number(layer[1]) - 1;
      counts[current] = 0;
      continue;
    }
    if (/^Anim Scene$/i.test(line)) {
      current = Math.max(3, counts.length);
      counts[current] = 0;
      continue;
    }
    if (/^Phase\s+\d+\s+@/i.test(line) && current >= 0) counts[current] += 1;
  }
  while (counts.length < 4) counts.push(0);
  return counts;
}

async function preparePage(page) {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', route =>
    route.fulfill({ path: threePath, contentType: 'text/javascript' }));
  await page.route('https://fonts.googleapis.com/**', route =>
    route.fulfill({ body: '', contentType: 'text/css' }));
  await page.addInitScript(() => {
    let clipboardText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async value => { clipboardText = String(value); },
        readText: async () => clipboardText,
      },
    });
    window.__testClipboard = {
      get: () => clipboardText,
      set: value => { clipboardText = String(value); },
    };
  });
  return runtimeErrors;
}

async function gotoApp(page, query = '') {
  await page.goto(`/index.html${query}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => typeof window.emotionSphere?.play)).toBe('function');
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText(/Layer 1\/\d+/);
}

async function openTimeline(page) {
  const timeline = page.locator('#anim-canvas-controls');
  if (!(await timeline.evaluate(element => element.classList.contains('open')))) {
    await page.locator('#rp-animation-row').click({ force: true });
  }
  await expect(timeline).toHaveClass(/\bopen\b/);
}

async function timelineCountsFromDom(page) {
  const tracks = page.locator('#rp-tracks > .rp-track:not(.rp-summary-track)');
  return tracks.evaluateAll(elements => elements.map(element => element.querySelectorAll('.rp-segment').length));
}

async function expectTimelineCounts(page, expected) {
  const isKiosk = await page.locator('body').evaluate(element => element.classList.contains('kiosk'));
  if (!isKiosk) await openTimeline(page);
  await expect.poll(() => timelineCountsFromDom(page)).toEqual(expected);
}

async function copyFromButton(page, selector) {
  await page.evaluate(() => window.__testClipboard.set(''));
  await page.locator(selector).evaluate(element => element.click());
  await expect.poll(() => page.evaluate(() => window.__testClipboard.get())).not.toBe('');
  return page.evaluate(() => window.__testClipboard.get());
}

async function setClipboard(page, text) {
  await page.evaluate(value => window.__testClipboard.set(value), text);
}

async function expectNoRuntimeErrors(page, runtimeErrors) {
  await expect(page.locator('#err')).toHaveText('');
  expect(runtimeErrors).toEqual([]);
}

module.exports = {
  copyFromButton,
  decodePresetUrl,
  emotionDots,
  encodePreset,
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  openTimeline,
  preparePage,
  readPreset,
  setClipboard,
  timelineCounts,
  timelineCountsFromDom,
};
