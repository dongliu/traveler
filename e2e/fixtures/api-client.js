const { request } = require('@playwright/test');
const { baseURL } = require('./env');
const { PRIMARY_AUTH_STATE, SECONDARY_AUTH_STATE } = require('./auth-state');

const contexts = new Map();

function storagePathFor(name) {
  return name === 'secondary' ? SECONDARY_AUTH_STATE : PRIMARY_AUTH_STATE;
}

async function contextFor(name, storagePath) {
  const file = storagePath || storagePathFor(name);
  if (!contexts.has(file)) {
    contexts.set(
      file,
      await request.newContext({ baseURL, storageState: file })
    );
  }
  return contexts.get(file);
}

async function send(name, method, urlPath, data, options = {}) {
  const context = await contextFor(name, options.storagePath);
  const response = await context.fetch(urlPath, {
    method,
    data,
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const text = await response.text();
  const headers = response.headers();
  let body = text;
  if ((headers['content-type'] || '').includes('application/json') && text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      body = text;
    }
  }
  return { status: response.status(), headers, body, text };
}

async function call(name, method, urlPath, data, options = {}) {
  const res = await send(name, method, urlPath, data, options);
  if (res.status < 200 || res.status >= 400) {
    const detail = res.text.slice(0, 300);
    throw new Error(
      `${method} ${urlPath} as ${name} failed with HTTP ${res.status}: ${detail}`
    );
  }
  return res;
}

function idFromResponse(res) {
  const source = [res.headers.location, res.body && res.body.location, res.text]
    .filter(Boolean)
    .join(' ');
  const match = source.match(/[0-9a-f]{24}/);
  if (!match) {
    throw new Error(`no document id in response: ${res.text.slice(0, 200)}`);
  }
  return match[0];
}

async function dropContext(storagePath) {
  const context = contexts.get(storagePath);
  if (context) {
    await context.dispose();
    contexts.delete(storagePath);
  }
}

async function disposeAll() {
  for (const context of contexts.values()) {
    await context.dispose();
  }
  contexts.clear();
}

module.exports = {
  send,
  call,
  idFromResponse,
  dropContext,
  disposeAll,
  storagePathFor,
};
