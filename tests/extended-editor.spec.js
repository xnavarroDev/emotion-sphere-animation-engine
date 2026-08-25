const { test, expect } = require('@playwright/test');
const {
  copyFromButton,
  decodePresetUrl,
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  openTimeline,
  preparePage,
  timelineCountsFromDom,
} = require('./helpers/app');

function setInputValue(locator, value) {
  return locator.evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('timeline phase columns can be inserted, renamed, eased, deleted, and undone', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);
  await openTimeline(page);

  await expectTimelineCounts(page, [3, 3, 3, 3]);
  await page.locator('.rp-seam-add').first().evaluate(element => element.click());
  await expectTimelineCounts(page, [4, 4, 4, 4]);

  const firstName = page.locator('.rp-phase-name').first();
  await firstName.fill('intro');
  await firstName.press('Enter');
  await expect(page.locator('.rp-phase-name').filter({ hasText: 'intro' })).toHaveCount(4);

  const firstDuration = page.locator('.rp-dur-edit').first();
  await firstDuration.fill('4.5');
  await firstDuration.press('Enter');
  await expect(page.locator('.rp-dur-edit').first()).toHaveText('4.5s');

  await page.locator('.ease-ico').first().click();
  await page.locator('.rp-ease-item').filter({ hasText: 'Linear' }).click();
  await expect(page.locator('.ease-ico').first()).toHaveAttribute('title', /Linear/);

  await page.locator('.rp-segment-del').first().evaluate(element => element.click());
  await expectTimelineCounts(page, [3, 3, 3, 3]);

  await page.locator('.rp-track-label').first().click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#rp-anim-clear-phases').click();
  await expect.poll(() => timelineCountsFromDom(page)).toEqual([0, 3, 3, 3]);

  await page.locator('#rp-undo-btn').click();
  await expectTimelineCounts(page, [3, 3, 3, 3]);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('background, gradient, rotation, and layer naming settings round-trip through a shared preset', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await page.locator('#rp-bg-group-head').click();
  await page.locator('#rp-glow-toggle').click();
  await setInputValue(page.locator('#rp-glow-opacity'), '0.45');
  await setInputValue(page.locator('#rp-glow-color'), '#123456');
  await setInputValue(page.locator('#rp-bg-color-a'), '#102030');
  await setInputValue(page.locator('#rp-bg-color-b'), '#405060');
  await page.locator('#rp-gradient-toggle').click();
  await expect(page.locator('#rp-gradient-toggle')).toHaveText('on');

  const motionGroup = page.locator('.rp-group').filter({ hasText: 'Motion' }).first();
  await motionGroup.locator('.rp-group-head').click();
  await page.locator('#rp-rotate-toggle').click();
  await setInputValue(page.locator('#rp-rotate-speed'), '0.25');
  await expect(page.locator('#rp-rotate-toggle')).toHaveClass(/\bon\b/);
  await expect(page.locator('#rp-rotate-speed-val')).toHaveText('0.250');

  await page.locator('#rp-layer-name').fill('Core layer');
  await page.locator('#rp-layer-next').click();
  await page.locator('#rp-layer-name').fill('Middle layer');

  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  const text = decodePresetUrl(sharedUrl);
  expect(text).toContain('name Core layer');
  expect(text).toContain('name Middle layer');
  expect(text).toContain('glowopacity 0.45');
  expect(text).toContain('glowcolor #123456');
  expect(text).toContain('bgcolor #102030');
  expect(text).toContain('bgcolor2 #405060');
  expect(text).toContain('bggradient 1.00');
  expect(text).toContain('rotate 1');
  expect(text).toContain('rotatespeed 0.250');
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('the Scene track can be focused, toggled, and edited without losing its phase state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);
  await openTimeline(page);

  const backgroundTrack = page.locator('#rp-tracks > .rp-track:not(.rp-summary-track)').filter({ hasText: 'Background' });
  const trackToggle = backgroundTrack.locator('.rp-track-toggle .rp-switch');
  await expect(trackToggle).toHaveClass(/\bon\b/);
  await trackToggle.click();
  await expect(trackToggle).not.toHaveClass(/\bon\b/);
  await expect(backgroundTrack).toHaveClass(/\boff\b/);
  await trackToggle.click();
  await expect(trackToggle).toHaveClass(/\bon\b/);

  await backgroundTrack.locator('.rp-segment').first().click();
  const setInputValue = (locator, value) => locator.evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await setInputValue(page.locator('#rp-bg-color-a'), '#102030');
  await setInputValue(page.locator('#rp-glow-opacity'), '0.35');

  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  const sceneText = decodePresetUrl(sharedUrl).split(/\nAnim Scene\n/i)[1];
  expect(sceneText).toContain('bgcolor #102030');
  expect(sceneText).toContain('glowopacity 0.35');
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('layer navigation, clear, and maximum layer limits preserve editor state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await page.locator('#rp-layer-name').fill('First layer');
  await page.locator('#rp-layer-next').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 2/3');
  await page.locator('#rp-layer-name').fill('Second layer');
  await page.locator('#rp-layer-prev').click();
  await expect(page.locator('#rp-layer-name')).toHaveValue('First layer');

  for (let i = 0; i < 5; i += 1) await page.locator('#rp-layer-add').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 8/8');
  await page.locator('#rp-layer-add').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 8/8');
  for (let i = 0; i < 5; i += 1) await page.locator('#rp-layer-remove').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 3/3');

  await page.locator('#rp-layer-clear').click();
  await expect(page.locator('#rp-groups .rp-slider-row').filter({ hasText: 'count' }).locator('input').first())
    .toHaveValue('0');
  await expectNoRuntimeErrors(page, runtimeErrors);
});
