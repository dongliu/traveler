/**
 * Generates a short, unique identifier for tagging test-created data
 * (part_number, wbs_number, etc.) so assertions can scope queries to only
 * the data a given scenario created — see data-model.md's Test Scenario
 * `runId` rule and research.md Decision 5 (cross-run isolation).
 *
 * Each call returns a fresh id (not a single value shared across the whole
 * suite run) — this is a stronger guarantee than "unique per run" alone: it
 * also prevents two scenarios within the *same* run from colliding on a
 * shared tag, which per-run-only uniqueness would not.
 */
function runId() {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${timestampPart}${randomPart}`;
}

module.exports = { runId };
