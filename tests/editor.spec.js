const { test, expect } = require('@playwright/test');
const {
  copyFromButton,
  decodePresetUrl,
  encodePreset,
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  openTimeline,
  preparePage,
  readPreset,
  timelineCountsFromDom,
  timelineCounts,
} = require('./helpers/app');

function firstParticleTrack(page) {
  return page.locator('#rp-tracks > .rp-track:not(.rp-summary-track)').first();
}

function parameterSlider(page, name) {
  return page.locator('#rp-groups .rp-slider-row').filter({ hasText: name }).locator('input').first();
}

test('phase edits are serialized and undo restores the previous snapshot', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const anger = readPreset('anger');
  await gotoApp(page, `?preset=${encodePreset(anger)}`);
  await page.locator('#anim-reset-btn').evaluate(element => element.click());
  await expectTimelineCounts(page, timelineCounts(anger));

  await firstParticleTrack(page).locator('.rp-segment').first().click();
  await expect(firstParticleTrack(page).locator('.rp-segment').first()).toHaveClass(/\bediting\b/);

  const count = parameterSlider(page, 'count');
  await count.evaluate(element => {
    element.value = '335';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#rp-undo-btn')).toBeEnabled();

  const editedUrl = await copyFromButton(page, '#rp-share-link');
  const editedText = decodePresetUrl(editedUrl);
  const firstLayer = editedText.split('Anim Layer 1')[1].split('Anim Layer 2')[0];
  expect(firstLayer).toMatch(/Phase 1 @ [\d.]+[\s\S]*count 335\.000/);

  await page.locator('#rp-undo-btn').click();
  const restoredUrl = await copyFromButton(page, '#rp-share-link');
  const restoredText = decodePresetUrl(restoredUrl);
  const restoredLayer = restoredText.split('Anim Layer 1')[1].split('Anim Layer 2')[0];
  expect(restoredLayer).toMatch(/Phase 1 @ [\d.]+[\s\S]*count 100\.000/);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('play, pause, reset, and loop controls update playback state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const calm = readPreset('calm');
  await gotoApp(page, `?preset=${encodePreset(calm)}`);
  await openTimeline(page);

  await page.locator('#rp-anim-reset').click();
  await expect(page.locator('#rp-anim-play-ico')).toHaveAttribute('src', 'icons/play.svg');
  await page.locator('#rp-anim-play').click();
  await expect(page.locator('#rp-anim-play-ico')).toHaveAttribute('src', 'icons/pause.svg');
  await page.waitForTimeout(150);
  await expect(page.locator('#rp-anim-time')).not.toHaveText('0:00/0:40');
  await page.locator('#rp-anim-play').click();
  await expect(page.locator('#rp-anim-play-ico')).toHaveAttribute('src', 'icons/play.svg');

  await page.locator('#rp-anim-loop').click();
  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  expect(decodePresetUrl(sharedUrl)).toMatch(/\nloop 0\n/);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('legacy animation controls remain synchronized with redesigned playback state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  const legacyPlay = page.locator('#anim-play-btn');
  await legacyPlay.evaluate(element => element.click());
  await expect(legacyPlay).toHaveClass(/\bactive\b/);
  await legacyPlay.evaluate(element => element.click());
  await expect(legacyPlay).not.toHaveClass(/\bactive\b/);

  const legacyLoop = page.locator('#anim-loop-chk');
  await legacyLoop.evaluate(element => {
    element.checked = false;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(legacyLoop).not.toBeChecked();
  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  expect(decodePresetUrl(sharedUrl)).toMatch(/\nloop 0\n/);

  await legacyPlay.evaluate(element => element.click());
  await expect(legacyPlay).toHaveClass(/\bactive\b/);
  await page.locator('#anim-bloom-btn').evaluate(element => element.click());
  await expect(legacyPlay).not.toHaveClass(/\bactive\b/);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('inner-layer copy, paste, reset, color override, and phase capture remain usable', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  const actions = page.locator('#inner-layer-actions button');
  await expect(actions).toHaveCount(4);
  const count = page.locator('#inner-layer-controls .row').filter({ hasText: 'count' }).locator('input').first();
  await count.evaluate(element => {
    element.value = '275';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await actions.nth(0).evaluate(element => element.click());
  await expect.poll(() => page.evaluate(() => window.__testClipboard.get())).toContain('count 275');
  await page.locator('#inner-layer-tabs button').last().evaluate(element => element.click());
  await actions.nth(1).evaluate(element => element.click());
  await expect(count).toHaveValue('275');

  await actions.nth(2).evaluate(element => element.click());
  await expect(count).not.toHaveValue('275');

  const color = page.locator('#inner-layer-controls input[type="color"]').first();
  await color.evaluate(element => {
    element.value = '#123456';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await actions.nth(0).evaluate(element => element.click());
  await expect.poll(() => page.evaluate(() => window.__testClipboard.get())).toContain('@red #123456');

  const phaseRows = page.locator('#anim-phases .anim-phase-row');
  const expectedPhaseRowsAfterCapture = (await timelineCountsFromDom(page))[0] + 1;
  await actions.nth(3).evaluate(element => element.click());
  await expect(phaseRows).toHaveCount(expectedPhaseRowsAfterCapture);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('layer copy/paste, add/remove, and renderer mode controls retain values', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);
  await page.locator('#anim-reset-btn').evaluate(element => element.click());

  const count = parameterSlider(page, 'count');
  await count.evaluate(element => {
    element.value = '320';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#rp-layer-copy').click();
  await expect(page.locator('#rp-layer-paste')).toBeEnabled();
  await page.locator('#rp-layer-next').click();
  await page.locator('#rp-layer-paste').click();
  await expect(parameterSlider(page, 'count')).toHaveValue('320');

  await page.locator('#rp-layer-add').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 4/4');
  await page.locator('#rp-layer-remove').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 3/3');

  await page.locator('#mode-fireflies').evaluate(element => element.click());
  await expect(page.locator('#mode-fireflies')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#classic-controls')).not.toHaveAttribute('style', /display:\s*none/);
  await page.locator('#mode-circles').evaluate(element => element.click());
  await expect(page.locator('#mode-circles')).toHaveClass(/\bactive\b/);
  await expectNoRuntimeErrors(page, runtimeErrors);
});
