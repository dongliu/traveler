const { request } = require('@playwright/test');
const { baseURL, personas } = require('./env');
const { storagePathFor, dropContext } = require('./api-client');

async function login(persona, storagePath) {
  // An explicit empty state stops the runner's `use.storageState` (the primary
  // session) from being attached, which would make the app treat the login as done.
  const context = await request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const res = await context.post('/ldaplogin/', {
      form: { username: persona.id, password: persona.password },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    if (res.status() !== 302 && res.status() !== 303) {
      const html = await res.text();
      const match = html.match(/An error occurred: ([^<]+)/);
      const reason = match ? match[1].trim() : `HTTP ${res.status()}`;
      throw new Error(
        `LOGIN FAILED for ${persona.name} (${persona.id}): ${reason}. ` +
          'Check the E2E user settings and that the LDAP service is up.'
      );
    }
    await context.storageState({ path: storagePath });
  } finally {
    await context.dispose();
  }
}

// The app copies a user's roles and local group memberships into the session at
// login, so a persona must log in again after either one changes.
async function refreshSession(name) {
  const storagePath = storagePathFor(name);
  await dropContext(storagePath);
  await login(personas[name], storagePath);
}

module.exports = { login, refreshSession };
