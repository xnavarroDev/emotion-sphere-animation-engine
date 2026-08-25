const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  globalSetup: require.resolve('./tests/global-setup'),
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
