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
const { attachFormOwners } = require('../../lib/traveler.js');

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
