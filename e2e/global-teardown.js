const { execFixtureCli } = require('./fixtures/exec-cli');
const { resolveEnv } = require('./fixtures/env');

/**
 * Removes the travelers, NCRs and binders this run created (through the tests, the fixture
 * CLI or the UI), with their uploaded files and closure PDFs. Runs after every test,
 * whether they passed or failed.
 *
 * Only records inserted after this run started and held by one of the two test identities
 * are removed (see fixtures/cli.js purge-run). Set E2E_KEEP_RECORDS=1 to keep them for
 * debugging; the run then prints a reminder that they are still there.
 */
module.exports = async function globalTeardown() {
  const runStartedAt = process.env.E2E_RUN_STARTED_AT;
  if (!runStartedAt) {
    console.warn('e2e teardown: no run marker was set, so nothing was purged');
    return;
  }
  if (process.env.E2E_KEEP_RECORDS === '1') {
    console.warn('e2e teardown: E2E_KEEP_RECORDS=1, this run\'s records were kept');
    return;
  }

  const env = resolveEnv();
  const creators = [env.primaryUser.username, env.secondaryUser.username];
  const removed = await execFixtureCli('purge-run', { runStartedAt, creators });
  const { ok, ...counts } = removed;
  const summary = Object.entries(counts)
    .map(([kind, n]) => `${kind} ${n}`)
    .join(', ');
  console.log(`e2e teardown: removed ${summary}`);
};
