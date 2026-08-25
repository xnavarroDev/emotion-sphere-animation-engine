const { test, expect } = require('@playwright/test');
const {
  expectNoRuntimeErrors,
  expectTimelineCounts,
  gotoApp,
  openTimeline,
  preparePage,
  timelineCountsFromDom,
} = require('./helpers/app');

test('timeline add-phase placement, scrubbing, phase resizing, and panel resizing work', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);
  await openTimeline(page);

  await page.locator('#rp-anim-add-phase').click();
  await expect(page.locator('body')).toHaveClass(/\brp-placing\b/);

  const lane = page.locator('#rp-tracks .rp-lane-vp').first();
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();
  await page.mouse.click(laneBox.x + laneBox.width * 0.15, laneBox.y + laneBox.height / 2);
  await page.mouse.click(laneBox.x + laneBox.width * 0.35, laneBox.y + laneBox.height / 2);
  await expect(page.locator('body')).not.toHaveClass(/\brp-placing\b/);
  // Placing inside an existing phase splits that phase around the new span,
  // so one placement creates three segments where there was previously one.
  await expectTimelineCounts(page, [5, 5, 5, 5]);

  const timeBeforeScrub = await page.locator('#rp-anim-time').textContent();
  const refreshedLaneBox = await lane.boundingBox();
  const scrubY = refreshedLaneBox.y + refreshedLaneBox.height / 2;
  await page.mouse.move(refreshedLaneBox.x + refreshedLaneBox.width * 0.5, scrubY);
  await page.mouse.down();
  await page.mouse.move(refreshedLaneBox.x + refreshedLaneBox.width * 0.75, scrubY);
  await page.mouse.up();
  await expect(page.locator('#rp-anim-time')).not.toHaveText(timeBeforeScrub);

  const resizeHandle = page.locator('#rp-tracks .rp-bracket-handle.right').first();
  await resizeHandle.hover();
  const handleBox = await resizeHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  const durationBeforeResize = await page.locator('.rp-dur-edit').first().textContent();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 24, handleBox.y + handleBox.height / 2);
  await page.mouse.up();
  await expect(page.locator('.rp-dur-edit').first()).not.toHaveText(durationBeforeResize);

  const grip = page.locator('#rp-anim-resize');
  const gripBox = await grip.boundingBox();
  expect(gripBox).not.toBeNull();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y - 80);
  await page.mouse.up();
  await expect(page.locator('#anim-canvas-controls')).toHaveAttribute('style', /height/);

  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('legacy playback controls and view toggles remain compatible with the redesigned state', async ({ page }) => {
  const runtimeErrors = await preparePage(page);
  await gotoApp(page);

  await page.locator('#toggle-glow').evaluate(element => element.click());
  await expect(page.locator('#toggle-glow')).not.toHaveClass(/\bactive\b/);
  await page.locator('#toggle-fireflies').evaluate(element => element.click());
  await expect(page.locator('#toggle-fireflies')).toHaveClass(/\bactive\b/);

  const count = page.locator('#rp-groups .rp-slider-row').filter({ hasText: 'count' }).locator('input').first();
  await expect(count).not.toHaveValue('0');
  await page.locator('#anim-zero-btn').evaluate(element => element.click());
  await expect(count).toHaveValue('0');
  await page.locator('#anim-defaults-btn').evaluate(element => element.click());
  await expect(count).not.toHaveValue('0');

  await page.locator('#anim-heading').evaluate(element => element.click());
  await expect(page.locator('#anim-body')).toHaveCSS('display', 'none');
  await page.locator('#anim-heading').evaluate(element => element.click());
  await expect(page.locator('#anim-body')).not.toHaveCSS('display', 'none');

  const before = await page.locator('#rp-tracks > .rp-track:not(.rp-summary-track)').count();
  await expect.poll(() => timelineCountsFromDom(page)).toEqual([3, 3, 3, 3]);
  expect(before).toBe(4);
  await expectNoRuntimeErrors(page, runtimeErrors);
});
