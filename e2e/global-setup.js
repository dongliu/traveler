const path = require('path');
const { chromium } = require('@playwright/test');
const { resolveEnv } = require('./fixtures/env');

const AUTH_DIR = path.join(__dirname, '.auth');

/**
 * Logs in as both configured test identities (primary = E2E_USER, secondary
 * = E2E_USER2, see research.md Decision 4) once, via the real /ldaplogin/ UI
 * form, and saves each session's storageState for reuse by every test
 * project (see playwright.config.js). Also performs a fail-fast reachability
 * check against the web app and Mailpit before attempting login, per FR-012.
 */
module.exports = async function globalSetup() {
  const fs = require('fs');
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const env = resolveEnv();

  await checkReachable('web app', env.webBaseUrl);
  await checkReachable('mail catcher', `${env.mailBaseUrl}/api/v1/messages`);

  await loginAndSaveState(env.webBaseUrl, env.primaryUser, path.join(AUTH_DIR, 'primary.json'));
  await loginAndSaveState(env.webBaseUrl, env.secondaryUser, path.join(AUTH_DIR, 'secondary.json'));
};

async function checkReachable(label, url) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    // Any HTTP response (including a redirect) means the service is up;
    // only a network-level failure (connection refused, DNS, etc.) throws.
    if (res.status >= 500) {
      throw new Error(`received HTTP ${res.status}`);
    }
  } catch (err) {
    throw new Error(
      `e2e/global-setup.js: ${label} is not reachable at ${url} (${err.message}). ` +
        'Is the local Docker Compose stack running? This suite never starts/stops containers itself — see quickstart.md Prerequisites.'
    );
  }
}

async function loginAndSaveState(webBaseUrl, credentials, storageStatePath) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: webBaseUrl });
  try {
    await page.goto('/ldaplogin/');
    await page.fill('input[name="username"]', credentials.username);
    await page.fill('input[name="password"]', credentials.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('button[type="submit"]'),
    ]);

    if (page.url().includes('/ldaplogin')) {
      throw new Error(
        `login as "${credentials.username}" appears to have failed — still on the login page after submit. ` +
          'Check E2E_USER/E2E_PASS (or E2E_USER2/E2E_PASS2) in .env.'
      );
    }

    await page.context().storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
}
