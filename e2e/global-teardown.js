const fs = require('fs');
const path = require('path');
const { ROOT } = require('./fixtures/env');
const { load, needsCleanup } = require('./fixtures/artifact-registry');
const { cleanOutAll } = require('./fixtures/cleanup');
const { disposeAll } = require('./fixtures/api-client');

module.exports = async function globalTeardown() {
  const runId = process.env.E2E_RUN_ID;
  if (!runId) {
    return;
  }
  try {
    await cleanOutAll(needsCleanup(load(runId)));
    const failed = load(runId).filter(r => r.cleanupStatus === 'failed');
    const reportDir = path.join(ROOT, 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    const summary = failed.map(r => ({
      kind: r.kind,
      id: r.id,
      title: r.title,
      error: r.cleanupError,
    }));
    fs.writeFileSync(
      path.join(reportDir, 'cleanup-failures.json'),
      JSON.stringify(summary, null, 2)
    );
    if (summary.length) {
      console.log('\nCleanup failures (not counted as scenario results):');
      for (const item of summary) {
        console.log(`  ${item.kind} ${item.id} "${item.title}": ${item.error}`);
      }
    }
  } finally {
    await disposeAll();
  }
};
