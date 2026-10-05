const path = require('path');
const { defineConfig } = require('@playwright/test');
const { baseURL } = require('./fixtures/env');
const { PRIMARY_AUTH_STATE } = require('./fixtures/auth-state');

const reportDir = path.join(__dirname, '..', 'playwright-report');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  outputDir: path.join(__dirname, '..', 'test-results'),
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: reportDir, open: 'never' }],
    ['json', { outputFile: path.join(reportDir, 'results.json') }],
  ],
  use: {
    baseURL,
    storageState: PRIMARY_AUTH_STATE,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
