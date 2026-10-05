const fs = require('fs');
const path = require('path');
const { AUTH_DIR } = require('./auth-state');

const RUNS_DIR = path.join(AUTH_DIR, 'runs');
const KIND_ORDER = { binder: 0, traveler: 1, form: 2, releasedForm: 3 };

let currentScenario = null;
let undoStack = [];

function registryFile(runId) {
  return path.join(RUNS_DIR, `${runId}.json`);
}

function currentRunId() {
  if (!process.env.E2E_RUN_ID) {
    throw new Error('E2E_RUN_ID is not set; global setup did not run');
  }
  return process.env.E2E_RUN_ID;
}

function load(runId = currentRunId()) {
  const file = registryFile(runId);
  if (!fs.existsSync(file)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(records, runId = currentRunId()) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(registryFile(runId), JSON.stringify(records, null, 2));
}

function record(entry) {
  const records = load();
  const created = {
    runId: currentRunId(),
    scenarioName: currentScenario,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    cleanupStatus: 'pending',
    cleanupError: null,
    dependsOn: [],
    ...entry,
  };
  records.push(created);
  save(records);
  return created;
}

function update(id, patch) {
  const records = load();
  const target = records.find(r => r.id === id);
  if (target) {
    Object.assign(target, patch);
    save(records);
  }
}

function markArchived(id) {
  update(id, {
    cleanupStatus: 'archived',
    cleanupError: null,
    archivedAt: new Date().toISOString(),
  });
}

function markFailed(id, error) {
  update(id, {
    cleanupStatus: 'failed',
    cleanupError: String(error.message || error),
  });
}

function needsCleanup(records) {
  return records.filter(r => r.cleanupStatus !== 'archived');
}

function dependentsFirst(records) {
  return [...records].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.createdAt.localeCompare(b.createdAt)
  );
}

function beginScenario(title) {
  currentScenario = title;
  undoStack = [];
}

function registerUndo(undo) {
  undoStack.push(undo);
}

function takeUndos() {
  const undos = undoStack.reverse();
  undoStack = [];
  return undos;
}

function scenarioName() {
  return currentScenario;
}

module.exports = {
  RUNS_DIR,
  currentRunId,
  load,
  save,
  record,
  markArchived,
  markFailed,
  needsCleanup,
  dependentsFirst,
  beginScenario,
  registerUndo,
  takeUndos,
  scenarioName,
};
