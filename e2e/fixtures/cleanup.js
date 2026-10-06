const { call } = require('./api-client');
const {
  currentRunId,
  load,
  markArchived,
  markFailed,
  needsCleanup,
  dependentsFirst,
  takeUndos,
  scenarioName,
} = require('./artifact-registry');

async function archive(record, options) {
  const who = record.ownerPersona;
  switch (record.kind) {
    case 'binder':
      await call(
        who,
        'PUT',
        `/binders/${record.id}/status`,
        { status: 3 },
        options
      );
      return;
    case 'traveler':
      await call(
        who,
        'PUT',
        `/travelers/${record.id}/archived`,
        { archived: true },
        options
      );
      return;
    case 'form': {
      const form = (
        await call(who, 'GET', `/forms/${record.id}/json`, undefined, options)
      ).body;
      if (form.status === 0.5) {
        const requests = (form.__review && form.__review.reviewRequests) || [];
        for (const request of requests) {
          await call(
            who,
            'DELETE',
            `/forms/${record.id}/review/requests/${request._id}`,
            undefined,
            options
          );
        }
      }
      await call(
        who,
        'PUT',
        `/forms/${record.id}/archived`,
        { archived: true },
        options
      );
      return;
    }
    case 'releasedForm': {
      const released = (
        await call(
          who,
          'GET',
          `/released-forms/${record.id}/json`,
          undefined,
          options
        )
      ).body;
      await call(
        who,
        'PUT',
        `/released-forms/${record.id}/status`,
        { status: 2, version: released.ver },
        options
      );
      return;
    }
    default:
      throw new Error(`unknown artifact kind ${record.kind}`);
  }
}

async function cleanOut(record, options = {}) {
  try {
    await archive(record, options);
    markArchived(record.id);
    return null;
  } catch (error) {
    markFailed(record.id, error);
    return error;
  }
}

async function cleanOutAll(records, options = {}) {
  const failures = [];
  for (const record of dependentsFirst(needsCleanup(records))) {
    const error = await cleanOut(record, options);
    if (error) {
      failures.push({ record, error: String(error.message || error) });
    }
  }
  return failures;
}

async function finishScenario(title) {
  const errors = [];
  for (const undo of takeUndos()) {
    try {
      await undo();
    } catch (error) {
      errors.push(error);
    }
  }
  const records = load(currentRunId()).filter(r => r.scenarioName === title);
  await cleanOutAll(records);
  if (errors.length) {
    throw new Error(
      `restoring state after "${title}" failed: ${errors
        .map(e => e.message)
        .join('; ')}`
    );
  }
}

module.exports = { cleanOut, cleanOutAll, finishScenario, scenarioName };
