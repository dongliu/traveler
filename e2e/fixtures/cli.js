#!/usr/bin/env node
/**
 * Fixture CLI — see specs/002-playwright-e2e-tests/contracts/fixture-cli.md.
 *
 * Runs INSIDE the `web` container (invoked via `docker compose exec`, see
 * e2e/fixtures/exec-cli.js), using the exact same MongoDB connection
 * bootstrap as app.js so it authenticates identically to the running app.
 *
 * This CLI performs direct Mongoose writes that bypass the app's own
 * service-layer validation/state-machine checks by design — it provisions
 * test preconditions, it does not exercise business logic. It is never
 * imported by or reachable from any production route.
 *
 * Usage: node e2e/fixtures/cli.js <command> '<json-args>'
 * Output: exactly one JSON line to stdout on success ({"ok":true,...}),
 *         or one JSON line to stderr + exit 1 on failure ({"ok":false,"error":"..."}).
 */

process.env.TRAVELER_CONFIG_REL_PATH = process.env.TRAVELER_CONFIG_REL_PATH || 'docker';

const fs = require('fs');
const mongoose = require('mongoose');
const config = require('../../config/config');

function fail(message) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exitCode = 1;
}

function succeed(result) {
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

async function connect() {
  // config.load() (and possibly required model files) can print stray lines
  // to stdout (e.g. an "optional module not found" notice) — suppress stdout
  // during setup so it never corrupts the single-JSON-line-on-stdout output
  // contract (contracts/fixture-cli.md); stderr is left alone.
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    config.load();
  } finally {
    process.stdout.write = originalWrite;
  }
  const mongoConfig = config.mongo;
  const mongoAddress =
    `mongodb://${mongoConfig.server_address || 'localhost'}` +
    `:${mongoConfig.server_port || '27017'}` +
    `/${mongoConfig.traveler_db || 'traveler'}`;

  const mongoOptions = {
    native_parser: true,
    poolSize: 5,
    connectTimeoutMS: 30000,
    keepAlive: 1,
  };
  if (mongoConfig.username !== undefined) {
    mongoOptions.user = mongoConfig.username;
    mongoOptions.pass = mongoConfig.password;
  }
  if (mongoConfig.auth) {
    mongoOptions.auth = mongoConfig.auth;
  }

  await mongoose.connect(mongoAddress, mongoOptions);
}

// ── commands ─────────────────────────────────────────────────────────────

async function grantRole({ userId, role }) {
  const { User } = require('../../model/user');
  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { roles: role } },
    { new: true }
  );
  if (!user) throw new Error(`User not found: ${userId}`);
  return { userId: user._id, roles: user.roles };
}

async function removeRole({ userId, role }) {
  const { User } = require('../../model/user');
  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { roles: role } },
    { new: true }
  );
  if (!user) throw new Error(`User not found: ${userId}`);
  return { userId: user._id, roles: user.roles };
}

async function resetUserRoles({ userId }) {
  const { User } = require('../../model/user');
  const user = await User.findByIdAndUpdate(userId, { roles: [] }, { new: true });
  if (!user) throw new Error(`User not found: ${userId}`);
  return { userId: user._id, roles: user.roles };
}

async function addGroupMember({ groupId, userId }) {
  const { Group } = require('../../model/user');
  const group = await Group.findByIdAndUpdate(
    groupId,
    { $addToSet: { members: userId }, $setOnInsert: { name: groupId, deleted: false } },
    { new: true, upsert: true }
  );
  return { groupId: group._id, members: group.members };
}

async function removeGroupMember({ groupId, userId }) {
  const { Group } = require('../../model/user');
  const update = userId ? { $pull: { members: userId } } : { $set: { members: [] } };
  const group = await Group.findByIdAndUpdate(groupId, update, { new: true });
  if (!group) return { groupId, members: [] };
  return { groupId: group._id, members: group.members };
}

async function setCeCs({ ncrId, ceCsId, ceCsName }) {
  const { Ncr } = require('../../model/ncr');
  const update = { ce_cs_id: ceCsId };
  if (ceCsName !== undefined) update.ce_cs_name = ceCsName;
  const ncr = await Ncr.findByIdAndUpdate(ncrId, update, { new: true });
  if (!ncr) throw new Error(`NCR not found: ${ncrId}`);
  return { ncrId: ncr._id.toString(), ce_cs_id: ncr.ce_cs_id };
}

async function backdateNcr({ ncrId, daysAgo }) {
  const { Ncr } = require('../../model/ncr');
  const backdated = new Date(Date.now() - Number(daysAgo) * 86400000);
  // Sets both created_at (what the dashboard's escalation logic actually
  // reads, per contracts/fixture-cli.md) and creation_timestamp (a separate
  // display field), so the NCR is realistically backdated on both.
  const ncr = await Ncr.findByIdAndUpdate(
    ncrId,
    { created_at: backdated, creation_timestamp: backdated },
    { new: true }
  );
  if (!ncr) throw new Error(`NCR not found: ${ncrId}`);
  return { ncrId: ncr._id.toString(), created_at: ncr.created_at.toISOString() };
}

async function createTravelerLinkedNcr({ ncrData, status, travelerId, inputName, inputLabel }) {
  const { Ncr } = require('../../model/ncr');
  const now = new Date();
  // Date.now() alone is millisecond-resolution, so concurrent invocations
  // from different spec files (separate `docker compose exec` processes
  // running in parallel Playwright workers) can collide on the unique
  // ncr_number index — append a random component to keep this unique even
  // when two calls land in the same millisecond.
  const ncrNumber = `NCR-FIXTURE-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const ncr = new Ncr({
    ncr_number: ncrNumber,
    status: status || 'Submitted',
    created_at: now,
    creation_timestamp: now,
    // Mirrors createNcr()'s own `if (data.traveler_id)` gate (lib/ncr-service.js)
    // — omitting travelerId yields a genuinely standalone NCR, not one with
    // initiated_from_traveler:true pointing at an undefined traveler.
    ...(travelerId
      ? {
          traveler_link: {
            traveler_id: travelerId,
            input_name: inputName,
            input_label: inputLabel,
            initiated_from_traveler: true,
          },
        }
      : {}),
    ...ncrData,
  });
  await ncr.save();
  return { ncrId: ncr._id.toString(), ncr_number: ncr.ncr_number };
}

// Creates a real, writable Traveler with one text input, bypassing the
// Form -> ReleasedForm -> Traveler UI pipeline (that pipeline is exercised
// elsewhere; this fixture only needs a traveler whose live page renders one
// fillable field for 123-traveler-ncr-input-linking's own e2e coverage).
// publicAccess: 0 (this app's actual default, per config/docker's app.json)
// grants read to any authenticated user while restricting writes to
// createdBy — exactly the split this feature's access model relies on.
async function createFillableTraveler({ createdBy, title, inputName, inputLabel }) {
  // model/traveler.js -> model/review.js expects `User` already registered
  // (it does `mongoose.model('User')` at require-time, not lazily) — every
  // other command that touches Traveler-side models is reached via a route
  // that already loaded model/user.js first at app startup; this fixture
  // CLI has no such guarantee, so require it explicitly first.
  require('../../model/user');
  const { Traveler } = require('../../model/traveler');
  const now = new Date();
  const name = inputName || 'field_1';
  const label = inputLabel || 'Field One';
  const html =
    '<div class="control-group">' +
    `<label class="control-label"><span>${label}</span></label>` +
    `<div class="controls"><input type="text" name="${name}"></div>` +
    '</div>';
  const traveler = new Traveler({
    title: title || 'E2E Fillable Traveler',
    status: 1,
    createdBy,
    createdOn: now,
    publicAccess: 0,
    forms: [
      {
        html,
        labels: { [name]: label },
        mapping: { [name]: name },
        reference: new mongoose.Types.ObjectId(),
        activatedOn: [now],
      },
    ],
    totalInput: 1,
    finishedInput: 0,
    touchedInputs: [],
  });
  await traveler.save();
  return { travelerId: traveler._id.toString() };
}

async function getNcr({ ncrId, fields }) {
  const { Ncr } = require('../../model/ncr');
  const projection = Array.isArray(fields)
    ? fields.reduce((acc, f) => ({ ...acc, [f]: 1 }), {})
    : undefined;
  const ncr = await Ncr.findById(ncrId, projection).lean();
  if (!ncr) throw new Error(`NCR not found: ${ncrId}`);
  return { ncr };
}

async function getUser({ userId }) {
  const { User } = require('../../model/user');
  const user = await User.findById(userId).lean();
  if (!user) throw new Error(`User not found: ${userId}`);
  return { userId: user._id, roles: user.roles || [] };
}

async function getGroup({ groupId }) {
  const { Group } = require('../../model/user');
  const group = await Group.findById(groupId).lean();
  if (!group) return { groupId, members: [] };
  return { groupId: group._id, members: group.members || [] };
}

// Checks the `web` container's own filesystem — used to prove a file was
// actually unlinked from disk (not just that a record referencing it is
// gone), which Playwright's page.request cannot observe on its own.
async function fileExists({ filePath }) {
  return { exists: fs.existsSync(filePath) };
}

const COMMANDS = {
  'grant-role': grantRole,
  'remove-role': removeRole,
  'reset-user-roles': resetUserRoles,
  'add-group-member': addGroupMember,
  'remove-group-member': removeGroupMember,
  'set-ce-cs': setCeCs,
  'backdate-ncr': backdateNcr,
  'create-traveler-linked-ncr': createTravelerLinkedNcr,
  'create-fillable-traveler': createFillableTraveler,
  'get-ncr': getNcr,
  'get-user': getUser,
  'get-group': getGroup,
  'file-exists': fileExists,
};

// ── entry point ──────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2];
  const argsJson = process.argv[3] || '{}';

  if (!command || !COMMANDS[command]) {
    fail(`Unknown or missing command: ${command}. Known commands: ${Object.keys(COMMANDS).join(', ')}`);
    return;
  }

  let args;
  try {
    args = JSON.parse(argsJson);
  } catch (err) {
    fail(`Invalid JSON args: ${err.message}`);
    return;
  }

  try {
    await connect();
    const result = await COMMANDS[command](args);
    succeed(result);
  } catch (err) {
    fail(err.message);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

main();
