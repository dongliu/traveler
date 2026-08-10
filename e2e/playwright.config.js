const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { resolveEnv } = require('./fixtures/env');

const env = resolveEnv();

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  fullyParallel: true,
  reporter: [
    ['html', { outputFolder: path.join(__dirname, '..', 'playwright-report') }],
    ['json', { outputFile: path.join(__dirname, '..', 'playwright-report', 'results.json') }],
  ],
  outputDir: path.join(__dirname, '..', 'test-results'),
  globalSetup: require.resolve('./global-setup.js'),

  use: {
    baseURL: env.webBaseUrl,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'primary',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, '.auth', 'primary.json'),
      },
    },
    {
      name: 'secondary',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, '.auth', 'secondary.json'),
      },
    },
  ],
});
