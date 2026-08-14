const sinon = require('sinon');
require('chai').should();

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

// Stub email.js's sendNotification *before* requiring ncr-email.js so the
// destructured local inside ncr-email.js picks up the stub (same pattern as
// test-unit/lib/ncr-service.test.js's ncr-email stubbing). Reuse an existing
// stub if another test file (e.g. review.test.js) already wrapped it — Mocha
// loads every test-unit/**/*.test.js file into one process, so a second
// unconditional sinon.stub() on the same method throws "already wrapped".
const emailModule = require('../../lib/email');
const sendNotificationStub = emailModule.sendNotification.isSinonProxy
  ? emailModule.sendNotification
  : sinon.stub(emailModule, 'sendNotification');

delete require.cache[require.resolve('../../lib/ncr-email.js')];
const {
  sendInitialNotification,
  sendDispositionRequest,
  sendQaNotification,
} = require('../../lib/ncr-email.js');

function makeNcr(overrides = {}) {
  return {
    ncr_number: 'NCR-2026-0001',
    part_name: 'Bracket',
    part_number: 'BA-1',
    supplier_name: 'Acme',
    originator_name: 'Origin Person',
    ce_cs_name: 'CE Person',
    description_of_nonconformance: 'Crack found on surface',
    ...overrides,
  };
}

beforeEach(() => {
  sendNotificationStub.reset();
  sendNotificationStub.resolves(true);
});

afterEach(() => {
  sinon.restore();
});

describe('lib/ncr-email — sendToRecipients (via sendInitialNotification)', () => {
  it('sends a single email with all recipients on the To line, not one per recipient', async () => {
    const recipients = ['qa1@test.com', 'qa2@test.com', 'qa3@test.com'];

    await sendInitialNotification(makeNcr(), recipients, 'http://x/ncrs/1');

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal(recipients.join(','));
  });

  it('joins CC addresses onto the same single send', async () => {
    await sendInitialNotification(makeNcr(), ['qa1@test.com'], 'http://x/ncrs/1', 'originator@test.com');

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].cc.should.equal('originator@test.com');
  });

  it('returns a result entry per TO recipient, all sharing the single send outcome', async () => {
    const recipients = ['qa1@test.com', 'qa2@test.com'];

    const { results } = await sendInitialNotification(makeNcr(), recipients, 'http://x/ncrs/1');

    results.should.have.lengthOf(2);
    results.every(r => r.delivery_status === 'Delivered').should.be.true;
  });

  it('returns a result entry per CC recipient, sharing the same outcome', async () => {
    const { cc } = await sendInitialNotification(makeNcr(), ['qa1@test.com'], 'http://x/ncrs/1', 'originator@test.com');

    cc.should.have.lengthOf(1);
    cc[0].recipient_email.should.equal('originator@test.com');
    cc[0].delivery_status.should.equal('Delivered');
  });

  it('marks every recipient Failed when the single send fails', async () => {
    sendNotificationStub.resolves(false);
    const recipients = ['qa1@test.com', 'qa2@test.com'];

    const { results, cc } = await sendInitialNotification(makeNcr(), recipients, 'http://x/ncrs/1', 'originator@test.com');

    results.every(r => r.delivery_status === 'Failed').should.be.true;
    cc.every(r => r.delivery_status === 'Failed').should.be.true;
  });

  it('marks every recipient Failed with the error message when sendNotification throws', async () => {
    sendNotificationStub.rejects(new Error('SMTP down'));
    const recipients = ['qa1@test.com', 'qa2@test.com'];

    const { results } = await sendInitialNotification(makeNcr(), recipients, 'http://x/ncrs/1');

    results.every(r => r.delivery_status === 'Failed' && r.error_message === 'SMTP down').should.be.true;
  });

  it('sends nothing and returns empty results when there are no recipients', async () => {
    const { results, cc } = await sendInitialNotification(makeNcr(), [], 'http://x/ncrs/1');

    sendNotificationStub.called.should.be.false;
    results.should.deep.equal([]);
    cc.should.deep.equal([]);
  });
});

describe('lib/ncr-email — sendDispositionRequest', () => {
  it('sends one email to all CE/CS recipients with the Originator CC\'d', async () => {
    await sendDispositionRequest(makeNcr(), 'cecs@test.com', 'http://x/ncrs/1', 'originator@test.com');

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal('cecs@test.com');
    sendNotificationStub.firstCall.args[0].cc.should.equal('originator@test.com');
  });
});

describe('lib/ncr-email — sendQaNotification (no CC use case)', () => {
  it('sends a single email to all QA staff recipients', async () => {
    const qaStaff = ['qa1@test.com', 'qa2@test.com'];

    const { results } = await sendQaNotification(makeNcr(), qaStaff);

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal(qaStaff.join(','));
    results.should.have.lengthOf(2);
  });
});
