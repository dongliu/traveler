const mongoose = require('mongoose');
const sinon = require('sinon');
require('chai').should();

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

if (!mongoose.modelNames().includes('User')) {
  mongoose.model('User', new mongoose.Schema({ _id: String, name: String, email: String, roles: [String] }));
}

const User = mongoose.model('User');
const { ensureUserExists } = require('../../lib/user-directory.js');

// User.prototype.save and User.findById may already be stubbed by another
// test-unit/**/*.test.js file's own top-level beforeEach -- Mocha loads every
// such file into one process, and an unguarded top-level hook applies to
// every test in the whole run, not just this file's. Reuse an existing stub
// (reconfiguring it for this test) instead of re-wrapping, the same
// "isSinonProxy" idiom test-unit/lib/ncr-email.test.js and
// test-unit/lib/review.test.js already use for this exact reason.
beforeEach(() => {
  if (!User.prototype.save.isSinonProxy) {
    sinon.stub(User.prototype, 'save');
  }
  User.prototype.save.resolves();

  if (!User.findById.isSinonProxy) {
    sinon.stub(User, 'findById');
  }
  User.findById.resolves(null);
});

afterEach(() => {
  sinon.restore();
});

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

describe('lib/user-directory — ensureUserExists', () => {
  it('creates a new User document from {id, name, email} when none exists', async () => {
    const result = await ensureUserExists({ id: 'newperson', name: 'New Person', email: 'new@test.com' });

    result._id.should.equal('newperson');
    result.name.should.equal('New Person');
    result.email.should.equal('new@test.com');
    User.prototype.save.calledOnce.should.be.true;
  });

  it('returns the existing document unchanged when one already exists, without saving', async () => {
    const existing = { _id: 'orig1', name: 'Origin', email: 'orig@test.com' };
    User.findById.resolves(existing);

    const result = await ensureUserExists({ id: 'orig1', name: 'Someone Else', email: 'someone@test.com' });

    result.should.equal(existing);
    User.prototype.save.called.should.be.false;
  });

  it('rejects with a 400 status when no document exists and email is missing, without saving', async () => {
    await expectRejection(ensureUserExists({ id: 'newperson', name: 'New Person', email: '' }), 400);

    User.prototype.save.called.should.be.false;
  });

  it('rejects with a 400 status when no document exists and email is undefined', async () => {
    await expectRejection(ensureUserExists({ id: 'newperson', name: 'New Person' }), 400);
  });

  it('creates a new document even when name is missing, since only id and email are required', async () => {
    const result = await ensureUserExists({ id: 'newperson', email: 'new@test.com' });

    result._id.should.equal('newperson');
    (result.name === undefined || result.name === null || result.name === '').should.be.true;
    User.prototype.save.calledOnce.should.be.true;
  });
});
