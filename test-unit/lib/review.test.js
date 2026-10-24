const mongoose = require('mongoose');
const sinon = require('sinon');
require('chai').should();

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

if (!mongoose.modelNames().includes('User')) {
  mongoose.model('User', new mongoose.Schema({ _id: String, name: String, email: String, roles: [String] }));
}

// Stub sendNotification and releaseForm on their module exports *before* loading
// lib/review.js so that the destructured locals inside review.js pick up the stubs.
// Reuse an existing sendNotification stub if another test file (e.g.
// ncr-email.test.js) already wrapped it — Mocha loads every
// test-unit/**/*.test.js file into one process, so a second unconditional
// sinon.stub() on the same method throws "already wrapped".
const emailModule = require('../../lib/email');
const formModule = require('../../lib/form');
const sendNotificationStub = emailModule.sendNotification.isSinonProxy
  ? emailModule.sendNotification
  : sinon.stub(emailModule, 'sendNotification');
sendNotificationStub.resolves();
sinon.stub(formModule, 'releaseForm').resolves();

// Stub getPermissions too -- config.permission/config.auth are only ever
// populated by config.load(), which nothing in this process calls before
// lib/review.js's addReviewRequest would need them (config.load() is only
// ever called by app.js at real startup, or by other test files' own
// describe-scoped before() hooks, which reload lib/permission.js fresh
// without lib/review.js following along). Defaulting to "has review
// permission" keeps addReviewRequest's own, unrelated permission check out
// of this file's way; a dedicated test overrides it to assert the opposite.
const permissionModule = require('../../lib/permission');
const getPermissionsStub = permissionModule.getPermissions.isSinonProxy
  ? permissionModule.getPermissions
  : sinon.stub(permissionModule, 'getPermissions');
getPermissionsStub.returns([permissionModule.Review_forms]);

// addReviewRequest reads config.auth.default_roles directly (not through
// getPermissions), so the stub above alone isn't enough -- config.auth is
// only otherwise populated by config.load(), which nothing in this process
// calls before this file's tests run. Set it directly, the same way
// test-unit/lib/ncr-service.test.js already sets config.wbsYaml.
const configModule = require('../../config/config.js');
configModule.auth = { default_roles: [] };

delete require.cache[require.resolve('../../lib/review.js')];
const { addReviewResult, addReviewRequest } = require('../../lib/review.js');

const User = mongoose.model('User');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReq(body = {}) {
  return {
    body: { result: '2', comment: 'needs work', v: '1', ...body },
    session: { userid: 'reviewer1' },
    protocol: 'http',
    get: sinon.stub().returns('localhost:3001'),
  };
}

function makeRes() {
  const res = {};
  res.status = sinon.stub().returns(res);
  res.send = sinon.stub().returns(res);
  return res;
}

function makeNewDoc(overrides = {}) {
  return {
    _id: 'doc123',
    createdBy: 'owner1',
    title: 'Test Form',
    status: 0.5,
    manPower: [],
    save: sinon.stub().resolves(),
    allApproved: sinon.stub().returns(false),
    constructor: { modelName: 'Form' },
    ...overrides,
  };
}

function stubUsers() {
  const reviewer = { _id: 'reviewer1', name: 'Alice', email: 'alice@test.com' };
  const owner    = { _id: 'owner1',    name: 'Bob',   email: 'bob@test.com' };
  sinon.stub(User, 'findOne')
    .onFirstCall().returns({ exec: () => Promise.resolve(reviewer) })
    .onSecondCall().returns({ exec: () => Promise.resolve(owner) });
  return { reviewer, owner };
}

// ── addReviewResult (lib/review.js) ──────────────────────────────────────────

describe('lib/review — addReviewResult', () => {
  afterEach(() => sinon.restore());

  it('calls rejectionFlow and returns 200 when result is rejection', async () => {
    const newDoc = makeNewDoc({ status: 0.5 });
    const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
    stubUsers();

    const req = makeReq({ result: '2' });
    const res = makeRes();

    await addReviewResult(req, res, doc);

    newDoc.save.calledOnce.should.be.true;
    newDoc.status.should.equal(0);
    res.status.calledWith(200).should.be.true;
  });

  it('returns 201 for a partial approval (not all approved)', async () => {
    const newDoc = makeNewDoc({ status: 0.5, allApproved: sinon.stub().returns(false) });
    const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
    stubUsers();

    const req = makeReq({ result: '1' });
    const res = makeRes();

    await addReviewResult(req, res, doc);

    res.status.calledWith(201).should.be.true;
  });

  it('returns 500 when doc.addReviewResult (model method) throws', async () => {
    const doc = { addReviewResult: sinon.stub().rejects(new Error('db error')) };

    const req = makeReq();
    const res = makeRes();

    await addReviewResult(req, res, doc);

    res.status.calledWith(500).should.be.true;
  });

  it('returns 500 when rejectionFlow\'s doc.save throws', async () => {
    const newDoc = makeNewDoc({ status: 0.5, save: sinon.stub().rejects(new Error('save failed')) });
    const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
    stubUsers();

    const req = makeReq({ result: '2' });
    const res = makeRes();

    await addReviewResult(req, res, doc);

    res.status.calledWith(500).should.be.true;
  });
});

// ── rejectionFlow (via addReviewResult) ──────────────────────────────────────

describe('lib/review — rejectionFlow', () => {
  afterEach(() => sinon.restore());

  describe('Form', () => {
    it('sets status to 0 and saves when form status is 0.5', async () => {
      const newDoc = makeNewDoc({ status: 0.5, constructor: { modelName: 'Form' } });
      const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
      stubUsers();

      await addReviewResult(makeReq({ result: '2' }), makeRes(), doc);

      newDoc.status.should.equal(0);
      newDoc.save.calledOnce.should.be.true;
    });

    it('does not save when form status is not 0.5', async () => {
      const newDoc = makeNewDoc({ status: 1, constructor: { modelName: 'Form' } });
      const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
      stubUsers();

      await addReviewResult(makeReq({ result: '2' }), makeRes(), doc);

      newDoc.save.called.should.be.false;
    });
  });

  describe('Traveler', () => {
    function stubUsersAndWorkers() {
      stubUsers();
      sinon.stub(User, 'find').returns({ exec: () => Promise.resolve([]) });
    }

    it('sets status to 1 and saves when traveler status is 1.5', async () => {
      const newDoc = makeNewDoc({ status: 1.5, constructor: { modelName: 'Traveler' } });
      const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
      stubUsersAndWorkers();

      await addReviewResult(makeReq({ result: '2' }), makeRes(), doc);

      newDoc.status.should.equal(1);
      newDoc.save.calledOnce.should.be.true;
    });

    it('does not save when traveler status is not 1.5', async () => {
      const newDoc = makeNewDoc({ status: 2, constructor: { modelName: 'Traveler' } });
      const doc = { addReviewResult: sinon.stub().resolves(newDoc) };
      stubUsersAndWorkers();

      await addReviewResult(makeReq({ result: '2' }), makeRes(), doc);

      newDoc.save.called.should.be.false;
    });
  });
});

// ── addReviewRequest (lib/review.js) ─────────────────────────────────────────

describe('lib/review — addReviewRequest', () => {
  // User.findById and User.prototype.save may already be stubbed by another
  // test-unit/**/*.test.js file's own top-level beforeEach (Mocha loads every
  // such file into one process) -- reuse an existing stub (reconfiguring it
  // for this test) instead of re-wrapping, the same "isSinonProxy" idiom
  // stubUsers() above and test-unit/lib/ncr-email.test.js already use.
  beforeEach(() => {
    if (!User.findById.isSinonProxy) {
      sinon.stub(User, 'findById');
    }
    if (!User.prototype.save.isSinonProxy) {
      sinon.stub(User.prototype, 'save');
    }
    User.prototype.save.resolves();
  });

  afterEach(() => sinon.restore());

  // addReviewRequest calls User.findById(...).exec(), while ensureUserExists
  // (lib/user-directory.js) calls User.findById(...) directly with a plain
  // await -- both reach the same stub, so its return value must satisfy
  // both calling conventions, the way a real Mongoose Query object (thenable
  // AND .exec()-able) does.
  function queryResolving(value) {
    const promise = Promise.resolve(value);
    promise.exec = () => Promise.resolve(value);
    return promise;
  }

  function makeRequestReq(body = {}) {
    return {
      body: { uid: 'newperson', name: 'New Person', email: 'new@test.com', ...body },
      session: { userid: 'owner1' },
      protocol: 'http',
      get: sinon.stub().returns('localhost:3001'),
    };
  }

  function makeRequestDoc(overrides = {}) {
    return {
      _id: 'doc123',
      title: 'Test Form',
      requestReview: sinon.stub().resolves(),
      ...overrides,
    };
  }

  it('provisions a User record for a reviewer who has never logged in, and adds the request', async () => {
    User.findById.returns(queryResolving(null));
    const doc = makeRequestDoc();

    const res = makeRes();
    await addReviewRequest(makeRequestReq(), res, doc);

    res.status.calledWith(201).should.be.true;
    doc.requestReview.calledOnce.should.be.true;
    User.prototype.save.calledOnce.should.be.true;
    const created = User.prototype.save.thisValues[0];
    created._id.should.equal('newperson');
    created.email.should.equal('new@test.com');
  });

  it('refuses the add with a 400 when the reviewer has never logged in and no email was submitted', async () => {
    User.findById.returns(queryResolving(null));
    const doc = makeRequestDoc();

    const res = makeRes();
    await addReviewRequest(makeRequestReq({ email: undefined }), res, doc);

    res.status.calledWith(400).should.be.true;
    doc.requestReview.called.should.be.false;
    User.prototype.save.called.should.be.false;
  });

  it('leaves an existing reviewer record untouched and behaves exactly as before this feature', async () => {
    const existing = { _id: 'newperson', name: 'New Person', email: 'old@test.com', roles: ['user'] };
    User.findById.returns(queryResolving(existing));
    const doc = makeRequestDoc();

    const res = makeRes();
    await addReviewRequest(makeRequestReq(), res, doc);

    res.status.calledWith(201).should.be.true;
    User.prototype.save.called.should.be.false;
  });
});
