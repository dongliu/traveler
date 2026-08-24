const sinon = require('sinon');
require('chai').should();

const {
  isValidWbsNumber,
  isValidEmail,
  listEntries,
  addEntry,
  updateEntry,
  removeEntry,
  resolveWbsContact,
} = require('../../lib/wbs-notification-service');

const { WbsNotification } = require('../../model/wbs-notification');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return { id: 'admin1', name: 'Admin Person', ...overrides };
}

function newEntry(overrides = {}) {
  return new WbsNotification({
    wbs_number: '1.2.3',
    notification_email: 'qa-lead@example.com',
    ...overrides,
  });
}

function thenableWithLean(value) {
  return {
    lean: () => Promise.resolve(value),
    then: resolve => resolve(value),
  };
}

// test-unit/lib/ncr-service.test.js's beforeEach/afterEach are declared at
// its file's top level (outside any describe()), which Mocha treats as
// GLOBAL hooks applying to every test in the whole run — including this
// file's, when both are loaded together (e.g. `mocha test-unit/**/*.test.js`).
// That global beforeEach already stubs WbsNotification.find fresh before
// every single test, from either file. So: reuse it via .returns() when it's
// already a sinon stub (combined-run case), or create a fresh stub when it
// isn't (this file run standalone, where ncr-service.test.js's hooks never
// registered).
function stubWbsFind(returnValue) {
  if (WbsNotification.find.isSinonProxy) {
    WbsNotification.find.returns(returnValue);
    return WbsNotification.find;
  }
  return sinon.stub(WbsNotification, 'find').returns(returnValue);
}

async function expectRejection(promise, status) {
  let threw = false;
  try {
    await promise;
  } catch (err) {
    threw = true;
    err.status.should.equal(status);
  }
  threw.should.be.true;
}

beforeEach(() => {
  sinon.stub(WbsNotification.prototype, 'save').resolves();
});

afterEach(() => {
  sinon.restore();
});

// ── format/email validators ─────────────────────────────────────────────────

describe('lib/wbs-notification-service — isValidWbsNumber', () => {
  it('accepts a single segment', () => {
    isValidWbsNumber('1').should.be.true;
  });

  it('accepts multiple dot-separated segments', () => {
    isValidWbsNumber('1.2.3').should.be.true;
  });

  it('accepts non-numeric segment contents', () => {
    isValidWbsNumber('WBS-A.b2.c-3').should.be.true;
  });

  it('rejects an empty string', () => {
    isValidWbsNumber('').should.be.false;
  });

  it('rejects consecutive dots', () => {
    isValidWbsNumber('1..2').should.be.false;
  });

  it('rejects a leading dot', () => {
    isValidWbsNumber('.1.2').should.be.false;
  });

  it('rejects a trailing dot', () => {
    isValidWbsNumber('1.2.').should.be.false;
  });

  it('rejects a non-string value', () => {
    isValidWbsNumber(undefined).should.be.false;
  });
});

describe('lib/wbs-notification-service — isValidEmail', () => {
  it('accepts a well-formed email', () => {
    isValidEmail('qa-lead@example.com').should.be.true;
  });

  it('rejects a string with no @', () => {
    isValidEmail('not-an-email').should.be.false;
  });

  it('rejects a string with no domain dot', () => {
    isValidEmail('user@localhost').should.be.false;
  });

  it('rejects a string containing whitespace', () => {
    isValidEmail('user @example.com').should.be.false;
  });
});

// ── listEntries ──────────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — listEntries', () => {
  it('returns every entry sorted by wbs_number', async () => {
    const sortStub = sinon.stub().returns({ lean: () => Promise.resolve([{ wbs_number: '1.2.3' }]) });
    stubWbsFind({ sort: sortStub });

    const entries = await listEntries();

    entries.should.deep.equal([{ wbs_number: '1.2.3' }]);
    sortStub.calledWith({ wbs_number: 1 }).should.be.true;
  });

  it('returns an empty array when the registry has no entries', async () => {
    stubWbsFind({ sort: () => ({ lean: () => Promise.resolve([]) }) });

    const entries = await listEntries();

    entries.should.deep.equal([]);
  });
});

// ── addEntry ─────────────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — addEntry', () => {
  it('throws 400 for a malformed WBS number', async () => {
    sinon.stub(WbsNotification, 'findOne').returns(thenableWithLean(null));
    await expectRejection(
      addEntry({ wbs_number: '1..2', notification_email: 'a@example.com' }, makeUser()),
      400
    );
  });

  it('throws 400 for an invalid email', async () => {
    sinon.stub(WbsNotification, 'findOne').returns(thenableWithLean(null));
    await expectRejection(
      addEntry({ wbs_number: '1.2.3', notification_email: 'not-an-email' }, makeUser()),
      400
    );
  });

  it('throws 409 when the WBS number already exists (case-sensitive exact match)', async () => {
    sinon.stub(WbsNotification, 'findOne').returns(thenableWithLean({ wbs_number: '1.2.3' }));
    await expectRejection(
      addEntry({ wbs_number: '1.2.3', notification_email: 'a@example.com' }, makeUser()),
      409
    );
  });

  it('creates a new entry with created_by/updated_by set from the user, trimming whitespace', async () => {
    sinon.stub(WbsNotification, 'findOne').returns(thenableWithLean(null));

    const entry = await addEntry(
      { wbs_number: '  1.2.3  ', notification_email: '  qa-lead@example.com  ' },
      makeUser({ id: 'admin1', name: 'Admin Person' })
    );

    entry.wbs_number.should.equal('1.2.3');
    entry.notification_email.should.equal('qa-lead@example.com');
    entry.created_by.should.equal('admin1');
    entry.created_by_name.should.equal('Admin Person');
    entry.updated_by.should.equal('admin1');
    entry.updated_by_name.should.equal('Admin Person');
    entry.created_at.should.be.instanceOf(Date);
  });

  it('treats different-case WBS numbers as distinct (case-sensitive uniqueness)', async () => {
    const findOneStub = sinon.stub(WbsNotification, 'findOne');
    findOneStub.withArgs({ wbs_number: 'wbs.1.2' }).returns(thenableWithLean(null));

    const entry = await addEntry(
      { wbs_number: 'wbs.1.2', notification_email: 'a@example.com' },
      makeUser()
    );

    entry.wbs_number.should.equal('wbs.1.2');
  });
});

// ── updateEntry ──────────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — updateEntry', () => {
  it('throws 404 when the WBS number is not in the registry', async () => {
    sinon.stub(WbsNotification, 'findOne').resolves(null);
    await expectRejection(updateEntry('1.2.3', { notification_email: 'a@example.com' }, makeUser()), 404);
  });

  it('throws 400 for an invalid email and leaves the stored email unchanged', async () => {
    const existing = newEntry({ notification_email: 'original@example.com' });
    sinon.stub(WbsNotification, 'findOne').resolves(existing);

    await expectRejection(updateEntry('1.2.3', { notification_email: 'not-an-email' }, makeUser()), 400);

    existing.notification_email.should.equal('original@example.com');
    WbsNotification.prototype.save.called.should.be.false;
  });

  it('updates notification_email, updated_by, updated_by_name, and updated_at', async () => {
    const existing = newEntry({ notification_email: 'original@example.com' });
    sinon.stub(WbsNotification, 'findOne').resolves(existing);

    const result = await updateEntry(
      '1.2.3',
      { notification_email: 'new-lead@example.com' },
      makeUser({ id: 'admin2', name: 'Second Admin' })
    );

    result.notification_email.should.equal('new-lead@example.com');
    result.updated_by.should.equal('admin2');
    result.updated_by_name.should.equal('Second Admin');
    result.updated_at.should.be.instanceOf(Date);
  });

  it('does not change wbs_number itself', async () => {
    const existing = newEntry({ wbs_number: '1.2.3' });
    sinon.stub(WbsNotification, 'findOne').resolves(existing);

    const result = await updateEntry('1.2.3', { notification_email: 'new@example.com' }, makeUser());

    result.wbs_number.should.equal('1.2.3');
  });
});

// ── removeEntry ──────────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — removeEntry', () => {
  it('throws 404 when the WBS number is not in the registry', async () => {
    sinon.stub(WbsNotification, 'findOneAndDelete').resolves(null);
    await expectRejection(removeEntry('1.2.3'), 404);
  });

  it('deletes and returns the matching entry', async () => {
    const existing = newEntry({ wbs_number: '1.2.3' });
    sinon.stub(WbsNotification, 'findOneAndDelete').resolves(existing);

    const result = await removeEntry('1.2.3');

    result.wbs_number.should.equal('1.2.3');
  });
});

// ── resolveWbsContact ────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — resolveWbsContact', () => {
  function stubFind(matches) {
    return stubWbsFind({ lean: () => Promise.resolve(matches) });
  }

  it('returns null for an empty/missing wbs number', async () => {
    stubFind([]);
    (await resolveWbsContact('') === null).should.be.true;
    (await resolveWbsContact(undefined) === null).should.be.true;
  });

  it('returns the exact match when it exists', async () => {
    const findStub = stubFind([{ wbs_number: '1.2' }]);

    const result = await resolveWbsContact('1.2');

    result.wbs_number.should.equal('1.2');
    findStub.firstCall.args[0].wbs_number.$in.should.deep.equal(['1.2', '1']);
  });

  it('falls back to the immediate parent when there is no exact match', async () => {
    stubFind([{ wbs_number: '1.2' }]);

    const result = await resolveWbsContact('1.2.1');

    result.wbs_number.should.equal('1.2');
  });

  it('prefers the nearer ancestor when multiple ancestor levels are registered', async () => {
    stubFind([{ wbs_number: '1' }, { wbs_number: '1.2' }]);

    const result = await resolveWbsContact('1.2.1');

    result.wbs_number.should.equal('1.2');
  });

  it('never matches a descendant of the given wbs number', async () => {
    // The query itself only ever includes wbsNumber and its ancestors, so a
    // descendant like '1.2.1.1' would never be returned by the stubbed
    // find() in practice — this asserts the candidate list sent to the
    // query excludes it, which is what guarantees that structurally.
    const findStub = stubFind([]);

    const result = await resolveWbsContact('1.2.1');

    (result === null).should.be.true;
    findStub.firstCall.args[0].wbs_number.$in.should.not.include('1.2.1.1');
  });

  it('returns null for a single-segment wbs number with no possible parent and no exact match', async () => {
    const findStub = stubFind([]);

    const result = await resolveWbsContact('9');

    (result === null).should.be.true;
    findStub.firstCall.args[0].wbs_number.$in.should.deep.equal(['9']);
  });

  it('returns null when neither the exact number nor any ancestor is registered', async () => {
    stubFind([]);

    const result = await resolveWbsContact('9.9.9');

    (result === null).should.be.true;
  });

  it('trims surrounding whitespace before building the candidate list', async () => {
    const findStub = stubFind([{ wbs_number: '1.2' }]);

    const result = await resolveWbsContact('  1.2  ');

    result.wbs_number.should.equal('1.2');
    findStub.firstCall.args[0].wbs_number.$in.should.deep.equal(['1.2', '1']);
  });
});
