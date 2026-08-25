const { test, expect } = require('@playwright/test');
const {
  emotionDots,
  encodePreset,
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  preparePage,
  readPreset,
  timelineCounts,
} = require('./helpers/app');

test('kiosk emotion mode keeps the selector and hides authoring controls', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const sad = readPreset('sad');
  await gotoApp(page, '?mode=kiosk&emotion=sad');

  await expect(page.locator('body')).toHaveClass(/\bkiosk\b/);
  await expect(page.locator('#params-panel')).toBeHidden();
  await expect(page.locator('#d-cycle')).toBeHidden();
  await expect(page.locator('#dots')).toBeVisible();
  await expect(page.locator(emotionDots.sad)).toHaveClass(/\bactive\b/);
  await expectTimelineCounts(page, timelineCounts(sad));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('kiosk shared-look mode hides the emotion selector', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const anger = readPreset('anger');
  await gotoApp(page, `?mode=kiosk&preset=${encodePreset(anger)}`);

  await expect(page.locator('body')).toHaveClass(/\bkiosk\b/);
  await expect(page.locator('body')).toHaveClass(/\bwatch\b/);
  await expect(page.locator('#dots')).toBeHidden();
  await expectTimelineCounts(page, timelineCounts(anger));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('kiosk mode hides the redesigned authoring panel and timeline', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page, '?mode=kiosk&emotion=sad');

  await expect(page.locator('#redesign-panel')).toBeHidden();
  await expect(page.locator('#anim-canvas-controls')).toBeHidden();
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('runtime API and postMessage switch complete emotion presets', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const warm = readPreset('warm');
  await gotoApp(page, '?mode=kiosk&emotion=calm');

  const invalidMessage = await page.evaluate(async () => {
    try {
      await window.emotionSphere.play('unknown-emotion');
      return null;
    } catch (error) {
      return error.message;
    }
  });
  expect(invalidMessage).toContain('unknown emotion');

  await page.evaluate(() => window.postMessage({ type: 'emotion', value: 'warm' }, '*'));
  await expect(page.locator(emotionDots.warm)).toHaveClass(/\bactive\b/);
  await expectTimelineCounts(page, timelineCounts(warm));
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('applyPreset accepts the documented plain-text preset format', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  const calm = readPreset('calm');
  await gotoApp(page);

  await page.evaluate(text => window.emotionSphere.applyPreset(text), calm);
  await expectTimelineCounts(page, timelineCounts(calm));
  await expectNoRuntimeErrors(page, runtimeErrors);
});
