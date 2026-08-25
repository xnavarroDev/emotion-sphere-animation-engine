const { test, expect } = require('@playwright/test');
const {
  copyFromButton,
  decodePresetUrl,
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  preparePage,
  readPreset,
  timelineCounts,
} = require('./helpers/app');

test('preset cards and the new-preset confirmation flow work', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await page.locator('.rp-card-stub').nth(1).click();
  await expectTimelineCounts(page, timelineCounts(readPreset('calm')));

  await page.locator('#rp-preset-name').fill('Unsaved card test');
  await page.locator('.rp-card-stub').first().click();
  await expect(page.locator('#rp-unsaved')).toHaveClass(/\bshow\b/);

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.rp-card-stub').first().click();
  await expect(page.locator('#rp-unsaved')).toHaveClass(/\bshow\b/);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('.rp-card-stub').first().click();
  await expect(page.locator('#rp-preset-name')).toHaveValue('');
  await expect(page.locator('#rp-unsaved')).not.toHaveClass(/\bshow\b/);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('legacy share and core reset controls remain callable', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  const legacyUrl = await copyFromButton(page, '#share-link');
  expect(legacyUrl).toContain('?mode=kiosk&preset=');
  expect(decodePresetUrl(legacyUrl)).toContain('Anim Scene');

  await page.locator('#reset-core-params').evaluate(element => element.click());
  await expect(page.locator('#err')).toHaveText('');
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('the cycle dot starts cycling and an emotion dot stops it', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await page.locator('#d-cycle').click();
  await expect(page.locator('#d-cycle')).toHaveClass(/\bactive\b/);

  await page.locator('#d-blue').click();
  await expect(page.locator('#d-cycle')).not.toHaveClass(/\bactive\b/);
  await expect(page.locator('#d-blue')).toHaveClass(/\bactive\b/);
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('keyboard escape cancels phase placement and closes the easing menu', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);
  await page.locator('#rp-animation-row').click({ force: true });

  await page.locator('#rp-anim-add-phase').click();
  await expect(page.locator('body')).toHaveClass(/\brp-placing\b/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/\brp-placing\b/);

  await page.locator('.ease-ico').first().click();
  await expect(page.locator('.rp-ease-menu')).toHaveCSS('display', 'block');
  await page.keyboard.press('Escape');
  await expect(page.locator('.rp-ease-menu')).toHaveCSS('display', 'none');
  await expectNoRuntimeErrors(page, runtimeErrors);
});
