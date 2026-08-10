const path = require('path');

/**
 * storageState paths for each configured test persona (research.md Decision 4).
 * PRIMARY is the default for every spec file (set as playwright.config.js's
 * top-level `use.storageState`). SECONDARY is opted into locally, only by
 * the specific tests that need a second real identity — e.g.:
 *
 *   const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');
 *   test.use({ storageState: SECONDARY_AUTH_STATE });
 */
const AUTH_DIR = path.join(__dirname, '..', '.auth');

module.exports = {
  PRIMARY_AUTH_STATE: path.join(AUTH_DIR, 'primary.json'),
  SECONDARY_AUTH_STATE: path.join(AUTH_DIR, 'secondary.json'),
};
