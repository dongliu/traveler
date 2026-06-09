const mongoose = require('mongoose');
const sinon = require('sinon');
require('chai').should();

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

if (!mongoose.modelNames().includes('User')) {
  mongoose.model('User', new mongoose.Schema({ _id: String, name: String, email: String, roles: [String] }));
}

// Stub sendNotification and releaseForm on their module exports *before* loading
// lib/review.js so that the destructured locals inside review.js pick up the stubs.
const emailModule = require('../../lib/email');
const formModule = require('../../lib/form');
sinon.stub(emailModule, 'sendNotification').resolves();
sinon.stub(formModule, 'releaseForm').resolves();

delete require.cache[require.resolve('../../lib/review.js')];
const { addReviewResult } = require('../../lib/review.js');

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
