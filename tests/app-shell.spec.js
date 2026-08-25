const { test, expect } = require('@playwright/test');
const {
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  preparePage,
} = require('./helpers/app');

test('editor boots with its public API, canvas, controls, and seeded timeline', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await expect(page).toHaveTitle('Emotion Sphere');
  await expect(page.locator('body')).not.toHaveClass(/\bkiosk\b/);
  await expect(page.locator('#redesign-panel')).toBeVisible();
  await expect(page.locator('body > canvas').first()).toBeVisible();
  await expect(page.locator('#rp-browse-btn')).toBeDisabled();
  await expect(page.locator('#rp-describe-textarea')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.emotionSphere.emotions.slice().sort()))
    .toEqual(['anger', 'angry', 'calm', 'happy', 'sad', 'warm']);
  await expectTimelineCounts(page, [3, 3, 3, 3]);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('panel collapse and layer add/remove controls preserve the editor state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await page.locator('#rp-collapse-btn').click();
  await expect(page.locator('body')).toHaveClass(/\brp-collapsed\b/);
  await page.locator('#rp-collapse-rail').click();
  await expect(page.locator('body')).not.toHaveClass(/\brp-collapsed\b/);

  await page.locator('#rp-layer-add').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 4/4');
  await page.locator('#rp-layer-remove').click();
  await expect(page.locator('#rp-layer-eyebrow')).toHaveText('Layer 3/3');
  await expectNoRuntimeErrors(page, runtimeErrors);
});
