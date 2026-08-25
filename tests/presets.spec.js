const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const {
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
  timelineCountsFromDom,
  timelineCounts,
} = require('./helpers/app');

for (const emotion of ['calm', 'sad', 'warm', 'anger']) {
  test(`?emotion=${emotion} loads the complete built-in preset`, async ({ page }) => {
    const runtimeErrors = await preparePage(page);
    const preset = readPreset(emotion);
    await gotoApp(page, `?emotion=${emotion}`);

    await expect(page.locator(emotionDots[emotion])).toHaveClass(/\bactive\b/);
    await expectTimelineCounts(page, timelineCounts(preset));
    await expectNoRuntimeErrors(page, runtimeErrors);
  });
}

test('a shared preset URL restores every particle and scene timeline', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const preset = readPreset('anger');
  const encoded = encodePreset(preset);

  await gotoApp(page, `?preset=${encoded}`);
  await expectTimelineCounts(page, timelineCounts(preset));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('the share button creates a self-contained URL that round-trips', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const preset = readPreset('anger');
  const expectedCounts = timelineCounts(preset);
  await gotoApp(page, '?emotion=anger');
  await expectTimelineCounts(page, expectedCounts);

  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  expect(sharedUrl).toContain('?mode=kiosk&preset=');
  expect(decodePresetUrl(sharedUrl)).toContain('Anim Layer 1');
  expect(decodePresetUrl(sharedUrl)).toContain('Anim Scene');

  const parsed = new URL(sharedUrl);
  await gotoApp(page, `${parsed.search}`);
  await expect(page.locator('body')).toHaveClass(/\bkiosk\b/);
  await expect(page.locator('body')).toHaveClass(/\bwatch\b/);
  await expectTimelineCounts(page, expectedCounts);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('a modified preset link restores editor changes in a fresh page', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?emotion=anger');
  await openTimeline(page);
  await page.locator('#rp-tracks .rp-segment').first().click();

  const count = page.locator('#rp-groups .rp-slider-row').filter({ hasText: 'count' }).locator('input').first();
  await count.evaluate(element => {
    element.value = '335';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.rp-dur-edit').first().fill('4.5');
  await page.locator('.rp-dur-edit').first().press('Enter');
  const expectedCounts = await timelineCountsFromDom(page);

  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  const sharedPage = await page.context().newPage();
  const sharedRuntimeErrors = await preparePage(sharedPage);
  await gotoApp(sharedPage, new URL(sharedUrl).search);
  await expectTimelineCounts(sharedPage, expectedCounts);

  const restoredUrl = await copyFromButton(sharedPage, '#rp-share-link');
  const restoredText = decodePresetUrl(restoredUrl);
  expect(restoredText).toMatch(/Phase 1 @ 4\.50[\s\S]*count 335\.000/);

  await expectNoRuntimeErrors(page, runtimeErrors);
  await expectNoRuntimeErrors(sharedPage, sharedRuntimeErrors);
});

test('representative particle parameters round-trip through a modified shared link', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?emotion=anger');
  await openTimeline(page);
  await page.locator('#rp-tracks .rp-segment').first().click();

  const setSliderValue = (name, value) => page.locator('#rp-groups .rp-slider-row')
    .filter({ hasText: new RegExp(`^${name}`) }).locator('input').first().evaluate((element, nextValue) => {
      element.value = nextValue;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  await setSliderValue('radius', '2.75');
  await setSliderValue('wander', '1.25');
  await setSliderValue('speed', '1.41');
  await page.locator('.rp-color-row input[type="color"]').first().evaluate(element => {
    element.value = '#123456';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const sharedUrl = await copyFromButton(page, '#rp-share-link');
  const sharedPage = await page.context().newPage();
  const sharedRuntimeErrors = await preparePage(sharedPage);
  await gotoApp(sharedPage, new URL(sharedUrl).search);
  const restoredUrl = await copyFromButton(sharedPage, '#rp-share-link');
  const restoredText = decodePresetUrl(restoredUrl);
  expect(restoredText).toMatch(/radius 2\.750/);
  expect(restoredText).toMatch(/wander 1\.250/);
  expect(restoredText).toMatch(/speed 1\.410/);
  expect(restoredText).toContain('colour #123456');
  await expectNoRuntimeErrors(page, runtimeErrors);
  await expectNoRuntimeErrors(sharedPage, sharedRuntimeErrors);
});

test('copy, save-to-clipboard, download, and load preserve preset text', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?emotion=anger');

  const copied = await copyFromButton(page, '#copy-params');
  expect(copied).toContain('Firefly Layer 1');
  expect(copied).toContain('Anim Layer 1');
  expect(copied).toContain('Anim Scene');

  await page.locator('#rp-preset-name').fill('Regression preset');
  await expect(page.locator('#rp-unsaved')).toHaveClass(/\bshow\b/);
  const saved = await copyFromButton(page, '#rp-save-btn');
  expect(saved).toContain('presetname Regression preset');
  await expect(page.locator('#rp-unsaved')).not.toHaveClass(/\bshow\b/);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-params').evaluate(element => element.click());
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^particle-params-\d+\.txt$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloadedText = await fs.readFile(downloadPath, 'utf8');
  expect(downloadedText).toContain('presetname Regression preset');
  expect(downloadedText).toContain('Anim Scene');

  const calm = readPreset('calm');
  await setClipboard(page, calm);
  await page.locator('#load-params').evaluate(element => element.click());
  await expectTimelineCounts(page, timelineCounts(calm));
  await expectNoRuntimeErrors(page, runtimeErrors);
});
