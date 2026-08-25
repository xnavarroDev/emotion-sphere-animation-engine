const { test, expect } = require('@playwright/test');
const {
  encodePreset,
  emotionDots,
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  preparePage,
  readPreset,
  timelineCounts,
} = require('./helpers/app');

test('emotion aliases load the same complete presets as their canonical names', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?emotion=happy');
  await expectTimelineCounts(page, timelineCounts(readPreset('warm')));
  await gotoApp(page, '?emotion=angry');
  await expectTimelineCounts(page, timelineCounts(readPreset('anger')));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('kiosk mode also starts through the embed query and emotion dots remain interactive', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?embed=1&emotion=calm');
  await expect(page.locator('body')).toHaveClass(/\bkiosk\b/);
  await page.locator(emotionDots.warm).click();
  await expect(page.locator(emotionDots.warm)).toHaveClass(/\bactive\b/);
  await expectTimelineCounts(page, timelineCounts(readPreset('warm')));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('a shared preset takes precedence over the emotion query parameter', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const anger = readPreset('anger');
  await gotoApp(page, `?mode=kiosk&emotion=calm&preset=${encodePreset(anger)}`);

  await expect(page.locator('body')).toHaveClass(/\bkiosk\b/);
  await expect(page.locator('body')).toHaveClass(/\bwatch\b/);
  await expect(page.locator('#dots')).toBeHidden();
  await expectTimelineCounts(page, timelineCounts(anger));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('a malformed shared URL does not crash the kiosk page', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?mode=kiosk&preset=not-a-valid-preset');
  await expect(page.locator('body')).toHaveClass(/\bkiosk\b/);
  await expect(page.locator('body')).toHaveClass(/\bwatch\b/);
  await expect(page.locator('#err')).toHaveText('');
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('loading a one-layer preset removes stale extra layers', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const calm = readPreset('calm');
  const oneLayer = [
    calm.match(/Firefly Layer 1[\s\S]*?(?=\nFirefly Layer 2)/i)[0],
    calm.match(/\nClassic[\s\S]*?(?=\nAnim Layer 1)/i)[0],
    calm.match(/Anim Layer 1[\s\S]*?(?=\nAnim Layer 2)/i)[0],
    calm.match(/Anim Scene[\s\S]*$/i)[0],
  ].join('\n');

  await gotoApp(page);
  await page.evaluate(text => window.emotionSphere.applyPreset(text), oneLayer);
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 1/1');
  const oneLayerCount = timelineCounts(calm)[0];
  await expectTimelineCounts(page, [oneLayerCount, oneLayerCount]);
  await expectNoRuntimeErrors(page, runtimeErrors);
});
