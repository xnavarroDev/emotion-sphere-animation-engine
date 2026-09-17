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

test('emotion controls expose button semantics and keyboard state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  const blue = page.locator('#d-blue');
  const cycle = page.locator('#d-cycle');
  await expect(blue).toHaveJSProperty('tagName', 'BUTTON');
  await expect(blue).toHaveAttribute('aria-pressed', 'false');

  await blue.focus();
  await page.keyboard.press('Enter');
  await expect(blue).toHaveAttribute('aria-pressed', 'true');

  await cycle.focus();
  await page.keyboard.press('Space');
  await expect(cycle).toHaveAttribute('aria-pressed', 'true');
  await expect(blue).toHaveAttribute('aria-pressed', 'false');
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('editor disclosures and custom sliders support keyboard interaction', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  const describe = page.locator('#rp-describe-head');
  await expect(describe).toHaveJSProperty('tagName', 'BUTTON');
  await expect(describe).toHaveAttribute('aria-expanded', 'true');
  await describe.focus();
  await page.keyboard.press('Space');
  await expect(describe).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#rp-describe-section')).toHaveClass(/\bcollapsed\b/);

  const background = page.locator('#rp-bg-group-head');
  await expect(background).toHaveJSProperty('tagName', 'BUTTON');
  await background.focus();
  await page.keyboard.press('Enter');
  await expect(background).toHaveAttribute('aria-expanded', 'true');

  const glow = page.locator('#rp-glow-toggle');
  await expect(glow).toHaveAttribute('aria-pressed', 'false');
  await glow.focus();
  await page.keyboard.press('Space');
  await expect(glow).toHaveAttribute('aria-pressed', 'true');

  const gradient = page.locator('#rp-gradient-thumb');
  await expect(gradient).toHaveAttribute('role', 'slider');
  await gradient.focus();
  await page.keyboard.press('End');
  await expect(gradient).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Home');
  await expect(gradient).toHaveAttribute('aria-valuenow', '0');

  const animation = page.locator('#rp-animation-row');
  await animation.focus();
  await page.keyboard.press('Enter');
  await expect(animation).toHaveAttribute('aria-expanded', 'true');

  const resize = page.locator('#rp-anim-resize');
  await expect(resize).toHaveAttribute('role', 'separator');
  await resize.focus();
  await page.keyboard.press('Home');
  await expect(resize).toHaveAttribute('aria-valuenow', '120');
  await page.keyboard.press('ArrowUp');
  await expect(resize).toHaveAttribute('aria-valuenow', '140');

  await expect(page.locator('#rp-bg-stop-a')).toHaveJSProperty('tagName', 'BUTTON');
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('background controls synchronize colors and remember nonzero toggle values', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);
  await page.locator('#rp-bg-group-head').click();

  const setInputValue = (locator, value) => locator.evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

  const glowOpacity = page.locator('#rp-glow-opacity');
  const glowToggle = page.locator('#rp-glow-toggle');
  await setInputValue(glowOpacity, '0.35');
  await expect(glowToggle).toHaveAttribute('aria-pressed', 'true');
  await glowToggle.click();
  await expect(glowOpacity).toHaveValue('0');
  await glowToggle.click();
  await expect(glowOpacity).toHaveValue('0.35');

  await setInputValue(page.locator('#rp-bg-color-a'), '#112233');
  await expect(page.locator('#rp-bg-stop-a')).toHaveCSS('background-color', 'rgb(17, 34, 51)');

  const gradientThumb = page.locator('#rp-gradient-thumb');
  const gradientToggle = page.locator('#rp-gradient-toggle');
  await gradientThumb.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await expect(gradientThumb).toHaveAttribute('aria-valuenow', '95');
  await gradientToggle.click();
  await expect(gradientThumb).toHaveAttribute('aria-valuenow', '0');
  await gradientToggle.click();
  await expect(gradientThumb).toHaveAttribute('aria-valuenow', '95');
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
  const easingMenu = page.locator('.rp-ease-menu');
  await expect(easingMenu).toHaveCSS('display', 'block');
  await expect(easingMenu).toHaveAttribute('role', 'menu');
  await expect(easingMenu.locator('[role="menuitemradio"][aria-checked="true"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(easingMenu).toHaveCSS('display', 'none');
  await expectNoRuntimeErrors(page, runtimeErrors);
});
