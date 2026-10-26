// Drives the mongo-express web UI to delete a single User document. There is
// no app-level route to remove a user (routes/user.js only ever adds one or
// edits roles), and Mongo's own port is not published to the host in
// docker-compose.yml, so mongo-express is the only reachable way to clean
// one up from outside the containers.
const { request } = require('@playwright/test');
const { MONGO_EXPRESS_PORT } = require('./env');

// Basic-auth credentials for mongo-express, hardcoded in docker-compose.yml
// (ME_CONFIG_BASICAUTH_USERNAME/PASSWORD) -- not a secret, same credentials
// the README already has an operator type into the browser by hand.
const AUTH_HEADER = `Basic ${Buffer.from('traveler:travelerpass').toString(
  'base64'
)}`;
const DB = 'traveler';
const COLLECTION = 'users';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Delete the users/<uid> document via mongo-express's own delete-row form.
 * Returns false (and does nothing) if the document isn't there -- safe to
 * call unconditionally from a test's teardown.
 */
async function deleteUserDocument(uid) {
  const context = await request.newContext({
    baseURL: `http://localhost:${MONGO_EXPRESS_PORT}`,
    extraHTTPHeaders: { Authorization: AUTH_HEADER },
  });
  try {
    const listing = await context.get(`/db/${DB}/${COLLECTION}`);
    if (!listing.ok()) {
      throw new Error(
        `mongo-express listing failed with HTTP ${listing.status()}`
      );
    }
    const html = await listing.text();
    const actionPattern = new RegExp(
      `action="(/db/${DB}/${COLLECTION}/%22${escapeRegExp(uid)}%22[^"]*)"`
    );
    const match = html.match(actionPattern);
    if (!match) {
      return false;
    }
    const action = match[1].replace(/&amp;/g, '&');
    const deletion = await context.post(action, {
      form: { _method: 'delete' },
    });
    if (!deletion.ok()) {
      throw new Error(
        `mongo-express delete of ${uid} failed with HTTP ${deletion.status()}`
      );
    }
    return true;
  } finally {
    await context.dispose();
  }
}

module.exports = { deleteUserDocument };
