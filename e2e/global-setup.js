const fs = require('fs');
const path = require('path');
const { request } = require('@playwright/test');
const {
  baseURL,
  WEB_PORT,
  personas,
  missingSettings,
} = require('./fixtures/env');
const {
  AUTH_DIR,
  PRIMARY_AUTH_STATE,
  SECONDARY_AUTH_STATE,
} = require('./fixtures/auth-state');
const { runId } = require('./fixtures/run-id');
const { call, disposeAll } = require('./fixtures/api-client');
const { login } = require('./fixtures/session');

async function checkWebApp() {
  const context = await request.newContext({ baseURL });
  try {
    await context.get('/ldaplogin/', { maxRedirects: 0 });
  } catch (error) {
    throw new Error(
      `web app is not reachable at ${baseURL} (WEB_PORT=${WEB_PORT}). ` +
        `Start the docker stack with "docker compose up" and check WEB_PORT. (${error.message})`
    );
  } finally {
    await context.dispose();
  }
}

async function checkPrimaryIsAdmin() {
  const res = await call(
    'primary',
    'GET',
    `/users/${encodeURIComponent(personas.primary.id)}/json`
  );
  const roles = (res.body && res.body.roles) || [];
  if (!roles.includes('admin')) {
    throw new Error(
      `primary test user ${
        personas.primary.id
      } must hold the admin role; it has [${roles.join(', ')}].`
    );
  }
}

module.exports = async function globalSetup() {
  const missing = missingSettings();
  if (missing.length) {
    throw new Error(
      `missing e2e settings (in .env or the shell): ${missing.join(', ')}`
    );
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await checkWebApp();
  await login(personas.primary, PRIMARY_AUTH_STATE);
  await login(personas.secondary, SECONDARY_AUTH_STATE);
  await checkPrimaryIsAdmin();
  await disposeAll();
  process.env.E2E_RUN_ID = runId();
  fs.mkdirSync(path.join(AUTH_DIR, 'runs'), { recursive: true });
};
