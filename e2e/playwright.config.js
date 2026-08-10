const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { resolveEnv } = require('./fixtures/env');
const { PRIMARY_AUTH_STATE } = require('./fixtures/auth-state');

const env = resolveEnv();

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  // Tests WITHIN one file run serially (Playwright's default when
  // fullyParallel is off); different files still run in parallel across
  // workers. Deliberate: several scenarios mutate shared state (e.g. US1's
  // ncr-qa-group-emptied test) that other tests in the same file rely on
  // being present — fullyParallel would let those race within a file.
  fullyParallel: false,
  reporter: [
    ['html', { outputFolder: path.join(__dirname, '..', 'playwright-report') }],
    ['json', { outputFile: path.join(__dirname, '..', 'playwright-report', 'results.json') }],
  ],
  outputDir: path.join(__dirname, '..', 'test-results'),
  globalSetup: require.resolve('./global-setup.js'),

  // Single project, logged in as the primary persona (E2E_USER) by default.
  // Deliberately NOT split into "primary"/"secondary" projects — Playwright
  // runs every matched spec file under every configured project, which would
  // (a) run every story's spec file twice for no reason, and (b) create a
  // real race condition for any test that mutates shared state (e.g. US1's
  // ncr-qa group-membership test) if both projects' workers hit it
  // concurrently under fullyParallel. The handful of scenarios that
  // genuinely need the secondary identity (E2E_USER2 — see research.md
  // Decision 4) opt in locally via `test.use({ storageState: SECONDARY_AUTH_STATE })`
  // from e2e/fixtures/auth-state.js, inside just that describe/test block.
  use: {
    ...devices['Desktop Chrome'],
    baseURL: env.webBaseUrl,
    storageState: PRIMARY_AUTH_STATE,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
