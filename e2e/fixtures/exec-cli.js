const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Finds the last line that parses as JSON — defensive against stray
 * non-JSON output mixed into the stream (see e2e/fixtures/cli.js's comment
 * on suppressing config.load()'s stdout notice; this is a second layer of
 * defense for anything unanticipated, e.g. Node deprecation warnings that
 * occasionally land on stdout depending on the Node version).
 */
function parseLastJsonLine(output) {
  const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith('{')) {
      try {
        return JSON.parse(lines[i]);
      } catch (_) {
        // not a JSON line, keep scanning backward
      }
    }
  }
  return null;
}

/**
 * Invokes the fixture CLI (e2e/fixtures/cli.js) inside the running `web`
 * container via `docker compose exec`, per contracts/fixture-cli.md.
 *
 * @param {string} command - one of the commands documented in contracts/fixture-cli.md
 * @param {object} args - JSON-serializable arguments for the command
 * @returns {Promise<object>} the command's result fields (without the `ok` wrapper)
 */
async function execFixtureCli(command, args = {}) {
  const argsJson = JSON.stringify(args);
  let stdout;
  let stderr;
  try {
    ({ stdout, stderr } = await execFileAsync(
      'docker',
      ['compose', 'exec', '-T', 'web', 'node', 'e2e/fixtures/cli.js', command, argsJson],
      { cwd: REPO_ROOT }
    ));
  } catch (err) {
    // execFile rejects on non-zero exit; err.stdout/err.stderr still carry the output
    stdout = err.stdout || '';
    stderr = err.stderr || '';
    const parsedError = parseLastJsonLine(stderr) || parseLastJsonLine(stdout);
    const reason = parsedError && parsedError.error ? parsedError.error : (stderr || err.message);
    throw new Error(
      `Fixture CLI command "${command}" failed: ${reason}\n` +
        `  args: ${argsJson}\n` +
        `  raw stderr: ${stderr}`
    );
  }

  const parsed = parseLastJsonLine(stdout);
  if (!parsed) {
    throw new Error(
      `Fixture CLI command "${command}" produced no parseable JSON output.\n  raw stdout: ${stdout}\n  raw stderr: ${stderr}`
    );
  }
  if (parsed.ok !== true) {
    throw new Error(`Fixture CLI command "${command}" returned ok:false — ${parsed.error}`);
  }
  const { ok, ...result } = parsed;
  return result;
}

module.exports = { execFixtureCli };
