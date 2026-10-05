const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readDotEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) {
    return values;
  }
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const dotEnv = readDotEnv(path.join(ROOT, '.env'));

function setting(name, fallback = '') {
  if (process.env[name]) {
    return process.env[name];
  }
  if (dotEnv[name]) {
    return dotEnv[name];
  }
  return fallback;
}

function authServicePort() {
  try {
    const auth = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'docker', 'auth.json'), 'utf8')
    );
    return new URL(auth.service).port || '3001';
  } catch (error) {
    return '3001';
  }
}

const WEB_PORT = setting('WEB_PORT', authServicePort());
const API_PORT = setting('API_PORT', '3002');
const baseURL = `http://localhost:${WEB_PORT}`;

const personas = {
  primary: {
    name: 'primary',
    id: setting('E2E_USER').toLowerCase(),
    password: setting('E2E_PASS'),
    displayName: setting('E2E_USER_NAME'),
    required: ['E2E_USER', 'E2E_PASS', 'E2E_USER_NAME'],
  },
  secondary: {
    name: 'secondary',
    id: setting('E2E_USER2').toLowerCase(),
    password: setting('E2E_PASS2'),
    displayName: setting('E2E_USER2_NAME'),
    required: ['E2E_USER2', 'E2E_PASS2', 'E2E_USER2_NAME'],
  },
};

function missingSettings() {
  return Object.values(personas)
    .flatMap(p => p.required)
    .filter(name => !setting(name));
}

module.exports = {
  ROOT,
  WEB_PORT,
  API_PORT,
  baseURL,
  personas,
  missingSettings,
};
