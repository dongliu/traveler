const mongoose = require('mongoose');
const sinon = require('sinon');
require('chai').should();

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

// model/traveler.js -> model/review.js registers against `User` at require
// time (same reason tests/lib/traveler-ncr.test.js guards this -- Mocha
// loads every tests/**/*.test.js file into one process, so whichever
// file runs first wins the registration and every other file must tolerate
// it already being there).
if (!mongoose.modelNames().includes('User')) {
  mongoose.model(
    'User',
    new mongoose.Schema({ _id: String, name: String, email: String })
  );
}

// lib/traveler.js does `mongoose.model('Form')` (retrieval only) at require
// time. A minimal stand-in schema is registered here rather than requiring
// the real model/form.js, which pulls in cheerio and the review/history
// plugins -- all unrelated to the function under test.
if (!mongoose.modelNames().includes('Form')) {
  mongoose.model(
    'Form',
    new mongoose.Schema({ createdBy: { type: String, ref: 'User' } })
  );
}

const Form = mongoose.model('Form');

// postTravelerStatusChangedMessage is a plain property access inside
// lib/traveler.js (not destructured), so stubbing the module export is
// enough -- no cache-delete/re-require needed. Reuse an existing stub if
// another tests/**/*.test.js file already wrapped it (Mocha loads every
// such file into one process).
const mqttModule = require('../../utilities/mqtt');
if (!mqttModule.postTravelerStatusChangedMessage.isSinonProxy) {
  sinon.stub(mqttModule, 'postTravelerStatusChangedMessage');
}

const { attachFormOwners, unarchiveTraveler } = require('../../lib/traveler.js');

describe('lib/traveler — attachFormOwners', () => {
  afterEach(() => {
    sinon.restore();
  });

  /** Makes Form.find(...).populate(...).lean() resolve to `forms`. */
  function stubForms(forms) {
    return sinon.stub(Form, 'find').returns({
      populate: () => ({ lean: () => Promise.resolve(forms) }),
    });
  }

  it("attaches the matching form's createdBy as formOwner", async () => {
    stubForms([{ _id: 'form1', createdBy: { _id: 'alice', name: 'Alice' } }]);
    const travelers = [{ _id: 't1', activeForm: 'form1' }];

    await attachFormOwners(travelers);

    travelers[0].formOwner.should.deep.equal({ _id: 'alice', name: 'Alice' });
  });

  it('leaves formOwner undefined when no Form matches activeForm', async () => {
    stubForms([]);
    const travelers = [{ _id: 't1', activeForm: 'missing-form' }];

    await attachFormOwners(travelers);

    (travelers[0].formOwner === undefined).should.be.true;
  });

  it('leaves formOwner undefined and never queries Form when no traveler has an activeForm', async () => {
    const find = sinon.stub(Form, 'find');
    const travelers = [{ _id: 't1' }, { _id: 't2', activeForm: '' }];

    await attachFormOwners(travelers);

    (travelers[0].formOwner === undefined).should.be.true;
    (travelers[1].formOwner === undefined).should.be.true;
    find.called.should.be.false;
  });

  it('resolves each traveler against its own activeForm when travelers share or differ on it', async () => {
    stubForms([
      { _id: 'formA', createdBy: { _id: 'alice', name: 'Alice' } },
      { _id: 'formB', createdBy: { _id: 'bob', name: 'Bob' } },
    ]);
    const travelers = [
      { _id: 't1', activeForm: 'formA' },
      { _id: 't2', activeForm: 'formB' },
      { _id: 't3', activeForm: 'formA' },
    ];

    await attachFormOwners(travelers);

    travelers[0].formOwner.should.deep.equal({ _id: 'alice', name: 'Alice' });
    travelers[1].formOwner.should.deep.equal({ _id: 'bob', name: 'Bob' });
    travelers[2].formOwner.should.deep.equal({ _id: 'alice', name: 'Alice' });
  });

  it('queries Form.find once with the deduplicated set of activeForm ids', async () => {
    const find = stubForms([]);
    const travelers = [
      { _id: 't1', activeForm: 'formA' },
      { _id: 't2', activeForm: 'formA' },
      { _id: 't3', activeForm: 'formB' },
    ];

    await attachFormOwners(travelers);

    find.calledOnce.should.be.true;
    const [filter] = find.firstCall.args;
    filter._id.$in.slice().sort().should.deep.equal(['formA', 'formB']);
  });

  it('returns the same array it was given, mutated in place', async () => {
    stubForms([]);
    const travelers = [{ _id: 't1', activeForm: 'formA' }];

    const result = await attachFormOwners(travelers);

    result.should.equal(travelers);
  });
});

// ── unarchiveTraveler (lib/traveler.js) ──────────────────────────────────────

describe('lib/traveler — unarchiveTraveler', () => {
  afterEach(() => {
    sinon.restore();
    // sinon.restore() is global, not scoped to this describe's own stubs --
    // it also undoes the module-level postTravelerStatusChangedMessage stub
    // above, so put it back for any test (in this file or another) that
    // runs after this one.
    if (!mqttModule.postTravelerStatusChangedMessage.isSinonProxy) {
      sinon.stub(mqttModule, 'postTravelerStatusChangedMessage');
    }
  });

  function makeReq(overrides = {}) {
    return {
      params: { id: 'id1' },
      session: { userid: 'admin1' },
      ...overrides,
    };
  }

  function makeRes() {
    const res = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
  }

  function makeTravelerDoc(overrides = {}) {
    return {
      _id: 'id1',
      status: 4,
      save: sinon.stub().resolves(),
      ...overrides,
    };
  }

  it('restores to the recorded prior status when archived from Active', async () => {
    const req = makeReq();
    const res = makeRes();
    const doc = makeTravelerDoc({ status: 4, statusBeforeArchive: 1 });
    req.id1 = doc;

    await unarchiveTraveler(req, res);

    doc.status.should.equal(1);
    (doc.statusBeforeArchive === undefined).should.be.true;
    doc.save.calledOnce.should.be.true;
    res.status.calledWith(200).should.be.true;
  });

  it('restores to the recorded prior status when archived from Completed', async () => {
    const req = makeReq();
    const res = makeRes();
    const doc = makeTravelerDoc({ status: 4, statusBeforeArchive: 2 });
    req.id1 = doc;

    await unarchiveTraveler(req, res);

    doc.status.should.equal(2);
  });

  it('restores to the recorded prior status when archived from Initialized', async () => {
    const req = makeReq();
    const res = makeRes();
    const doc = makeTravelerDoc({ status: 4, statusBeforeArchive: 0 });
    req.id1 = doc;

    await unarchiveTraveler(req, res);

    doc.status.should.equal(0);
  });

  it('falls back to Active when no prior status was recorded', async () => {
    const req = makeReq();
    const res = makeRes();
    const doc = makeTravelerDoc({ status: 4, statusBeforeArchive: undefined });
    req.id1 = doc;

    await unarchiveTraveler(req, res);

    doc.status.should.equal(1);
  });

  it('refuses when the traveler is not currently archived', async () => {
    const req = makeReq();
    const res = makeRes();
    const doc = makeTravelerDoc({ status: 1 });
    req.id1 = doc;

    await unarchiveTraveler(req, res);

    res.status.calledWith(409).should.be.true;
    doc.save.called.should.be.false;
  });
});

// ── updateStatus archiving (statusBeforeArchive capture) ────────────────────

describe('lib/traveler — updateStatus archiving', () => {
  let updateStatus;

  before(() => {
    sinon.stub(require('../../utilities/routes'), 'hasPermission').returns(true);
    sinon
      .stub(require('../../lib/traveler-ncr'), 'isSubmissionTransition')
      .returns(false);
    // isSubmissionTransition is destructured by lib/traveler.js at require
    // time, so the module must be freshly required after stubbing it for
    // the new value to be picked up (hasPermission, by contrast, is a plain
    // property access and would already see the stub either way).
    delete require.cache[require.resolve('../../lib/traveler.js')];
    ({ updateStatus } = require('../../lib/traveler.js'));
  });

  after(() => {
    sinon.restore();
    if (!mqttModule.postTravelerStatusChangedMessage.isSinonProxy) {
      sinon.stub(mqttModule, 'postTravelerStatusChangedMessage');
    }
    // Leave the require cache as this file found it, so nothing else in
    // this process can end up with the stubbed closure above.
    delete require.cache[require.resolve('../../lib/traveler.js')];
  });

  it('captures statusBeforeArchive when archiving', async () => {
    const req = {
      params: { id: 'id1' },
      session: { userid: 'admin1' },
      body: { status: 4 },
    };
    const res = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    const doc = {
      _id: 'id1',
      status: 2,
      statusBeforeArchive: undefined,
      save: sinon.stub().callsFake(function(cb) {
        cb(null);
      }),
    };
    req.id1 = doc;

    await updateStatus(req, res);

    doc.statusBeforeArchive.should.equal(2);
    doc.save.calledOnce.should.be.true;
  });
});
