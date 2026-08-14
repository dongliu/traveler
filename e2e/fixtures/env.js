const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = ['E2E_USER', 'E2E_PASS', 'E2E_USER2', 'E2E_PASS2'];

const DEFAULTS = {
  WEB_PORT: '3001',
  API_PORT: '3002',
  MONGO_EXPRESS_PORT: '8081',
  MAIL_PORT: '8025',
};

function parseDotEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function resolveEnv() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const dotEnvVars = parseDotEnv(path.join(repoRoot, '.env'));
  const merged = { ...dotEnvVars, ...process.env };

  const missing = REQUIRED_VARS.filter(key => !merged[key]);
  if (missing.length > 0) {
    throw new Error(
      `e2e/fixtures/env.js: missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in the repo-root .env file (see .env.example) before running the suite.'
    );
  }

  const webPort = merged.WEB_PORT || DEFAULTS.WEB_PORT;
  const apiPort = merged.API_PORT || DEFAULTS.API_PORT;
  const mongoExpressPort = merged.MONGO_EXPRESS_PORT || DEFAULTS.MONGO_EXPRESS_PORT;
  const mailPort = merged.MAIL_PORT || DEFAULTS.MAIL_PORT;

  return {
    webBaseUrl: `http://localhost:${webPort}`,
    apiBaseUrl: `http://localhost:${apiPort}`,
    mongoExpressBaseUrl: `http://localhost:${mongoExpressPort}`,
    mailBaseUrl: `http://localhost:${mailPort}`,
    primaryUser: { username: merged.E2E_USER, password: merged.E2E_PASS },
    secondaryUser: { username: merged.E2E_USER2, password: merged.E2E_PASS2 },
  };
}

module.exports = { resolveEnv };
