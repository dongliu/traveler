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
  sendApprovalRequest,
  sendIssuance,
  sendFinalDistribution,
  sendPaAssigned,
  sendDesignateAssigned,
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

function capturedHtml() {
  return sendNotificationStub.firstCall.args[0].html;
}
function capturedSubject() {
  return sendNotificationStub.firstCall.args[0].subject;
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

    const results = await sendQaNotification(makeNcr(), qaStaff);

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal(qaStaff.join(','));
    results.should.have.lengthOf(2);
  });
});

// The four describe blocks below guard against a real regression found while
// implementing 003-originator-designate: these functions (and sendPaAssigned)
// all returned sendToRecipients' raw {results, ccResults} object instead of a
// plain array, which every caller in lib/ncr-service.js expects — a live
// TypeError ("results.map is not a function") on disposition submission, QA
// concurrence, approval, return-for-comment, resubmit, closure, and PA owner
// assignment. None of these functions had any direct test coverage before.

describe('lib/ncr-email — sendApprovalRequest', () => {
  it('sends a single email to all approvers and returns a plain result array', async () => {
    const approvers = ['appr1@test.com', 'appr2@test.com'];

    const results = await sendApprovalRequest(makeNcr(), approvers);

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal(approvers.join(','));
    results.should.have.lengthOf(2);
    results.every(r => r.delivery_status === 'Delivered').should.be.true;
  });
});

describe('lib/ncr-email — sendIssuance', () => {
  it('sends a single email to the Originator (and Designate, if included) and returns a plain result array', async () => {
    const recipients = ['orig@test.com', 'designate@test.com'];

    const results = await sendIssuance(makeNcr(), recipients);

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal(recipients.join(','));
    results.should.have.lengthOf(2);
  });
});

describe('lib/ncr-email — sendFinalDistribution', () => {
  it('sends a single email to all stakeholders and returns a plain result array', async () => {
    const recipients = ['a@test.com', 'b@test.com', 'c@test.com'];

    const results = await sendFinalDistribution(makeNcr(), recipients);

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal(recipients.join(','));
    results.should.have.lengthOf(3);
  });
});

describe('lib/ncr-email — sendPaAssigned', () => {
  it('sends to the owner\'s email address (not the owner object itself) and returns a plain result array', async () => {
    const pa = { action_description: 'Update work instruction', target_completion_date: new Date() };
    const owner = { recipient_id: 'owner1', email: 'owner1@test.com' };

    const results = await sendPaAssigned(makeNcr(), pa, owner);

    sendNotificationStub.callCount.should.equal(1);
    sendNotificationStub.firstCall.args[0].recipients.should.equal('owner1@test.com');
    results.should.have.lengthOf(1);
    results[0].recipient_email.should.equal('owner1@test.com');
  });
});

// ── Email format / content tests (spec: specs/emais.md) ──────────────────────

describe('lib/ncr-email — sendInitialNotification format (spec email 2)', () => {
  it('uses the correct subject line', async () => {
    await sendInitialNotification(makeNcr(), ['qa@test.com'], 'http://app/ncrs/1');
    capturedSubject().should.equal('NCR NCR-2026-0001 Initiated — Bracket');
  });

  it('body mentions NCR number, part, supplier, originator and CE/CS', async () => {
    await sendInitialNotification(makeNcr(), ['qa@test.com'], 'http://app/ncrs/1');
    const html = capturedHtml();
    html.should.include('NCR-2026-0001');
    html.should.include('Bracket');
    html.should.include('Acme');
    html.should.include('Origin Person');
    html.should.include('CE Person');
    html.should.include('forwarded to');
    html.should.include('engineering disposition');
  });

  it('body includes the problem description', async () => {
    await sendInitialNotification(makeNcr(), ['qa@test.com'], 'http://app/ncrs/1');
    capturedHtml().should.include('Crack found on surface');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendInitialNotification(makeNcr(), ['qa@test.com'], 'http://app/ncrs/42');
    const html = capturedHtml();
    html.should.include('href="http://app/ncrs/42"');
    html.should.include('following the link below');
  });

  it('omits the link section when ncrUrl is absent', async () => {
    await sendInitialNotification(makeNcr(), ['qa@test.com'], '');
    capturedHtml().should.not.include('href=');
  });
});

describe('lib/ncr-email — sendDispositionRequest format (spec email 1)', () => {
  it('uses the correct subject line', async () => {
    await sendDispositionRequest(makeNcr(), 'cecs@test.com', 'http://app/ncrs/1', 'orig@test.com');
    capturedSubject().should.equal('Action Required — Engineering Disposition for NCR NCR-2026-0001');
  });

  it('body addresses CE/CS by name', async () => {
    await sendDispositionRequest(makeNcr(), 'cecs@test.com', 'http://app/ncrs/1');
    capturedHtml().should.include('CE Person');
  });

  it('body asks CE/CS to complete the section and includes originator name', async () => {
    await sendDispositionRequest(makeNcr(), 'cecs@test.com', 'http://app/ncrs/1');
    const html = capturedHtml();
    html.should.include('Please complete the CE/CS');
    html.should.include('Origin Person');
    html.should.include('Acme');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendDispositionRequest(makeNcr(), 'cecs@test.com', 'http://app/ncrs/7');
    capturedHtml().should.include('href="http://app/ncrs/7"');
  });

  it('uses fallback text when ncrUrl is absent', async () => {
    await sendDispositionRequest(makeNcr(), 'cecs@test.com', '');
    capturedHtml().should.include('Please log in');
  });
});

describe('lib/ncr-email — sendQaNotification format (spec email 3)', () => {
  it('uses the correct subject for the default path', async () => {
    await sendQaNotification(makeNcr(), ['qa@test.com'], null, 'http://app/ncrs/1');
    capturedSubject().should.equal('NCR NCR-2026-0001 Ready for QA Concurrence');
  });

  it('body opens with "QA Admin:" greeting', async () => {
    await sendQaNotification(makeNcr(), ['qa@test.com'], null, 'http://app/ncrs/1');
    capturedHtml().should.include('QA Admin');
  });

  it('body states CE/CS section was completed by CE/CS name', async () => {
    await sendQaNotification(makeNcr(), ['qa@test.com'], null, 'http://app/ncrs/1');
    const html = capturedHtml();
    html.should.include('CE Person');
    html.should.include('completed by');
    html.should.include('Please complete the QA section');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendQaNotification(makeNcr(), ['qa@test.com'], null, 'http://app/ncrs/5');
    capturedHtml().should.include('href="http://app/ncrs/5"');
  });

  it('omits the link when ncrUrl is absent', async () => {
    await sendQaNotification(makeNcr(), ['qa@test.com']);
    capturedHtml().should.not.include('href=');
  });

  it('uses the returned_for_comment subject and body when context is set', async () => {
    await sendQaNotification(makeNcr(), ['qa@test.com'], 'returned_for_comment', 'http://app/ncrs/1');
    capturedSubject().should.equal('NCR NCR-2026-0001 Returned for Comment — QA Action Required');
    capturedHtml().should.include('returned');
    capturedHtml().should.include('href="http://app/ncrs/1"');
  });
});

describe('lib/ncr-email — sendApprovalRequest format (spec email 5)', () => {
  it('uses the correct subject line', async () => {
    await sendApprovalRequest(makeNcr(), ['appr@test.com'], 'http://app/ncrs/1');
    capturedSubject().should.equal('Action Required — Approval Needed for NCR NCR-2026-0001');
  });

  it('body opens with "Approvers:" greeting', async () => {
    await sendApprovalRequest(makeNcr(), ['appr@test.com'], 'http://app/ncrs/1');
    capturedHtml().should.include('Approvers');
  });

  it('body mentions NCR, part, supplier and approved-by name', async () => {
    await sendApprovalRequest(makeNcr(), ['appr@test.com'], 'http://app/ncrs/1', 'Jane QA');
    const html = capturedHtml();
    html.should.include('NCR-2026-0001');
    html.should.include('Bracket');
    html.should.include('Acme');
    html.should.include('Jane QA');
    html.should.include('ready for');
  });

  it('falls back to "QA Admin" when approvedByName is omitted', async () => {
    await sendApprovalRequest(makeNcr(), ['appr@test.com'], 'http://app/ncrs/1');
    capturedHtml().should.include('QA Admin');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendApprovalRequest(makeNcr(), ['appr@test.com'], 'http://app/ncrs/9');
    capturedHtml().should.include('href="http://app/ncrs/9"');
  });

  it('omits the link when ncrUrl is absent', async () => {
    await sendApprovalRequest(makeNcr(), ['appr@test.com']);
    capturedHtml().should.not.include('href=');
  });
});

describe('lib/ncr-email — sendIssuance format (spec email 6)', () => {
  it('uses the correct subject line', async () => {
    await sendIssuance(makeNcr(), ['orig@test.com'], 'http://app/ncrs/1');
    capturedSubject().should.equal('NCR NCR-2026-0001 — Final Approval Reached');
  });

  it('body addresses the originator by name', async () => {
    await sendIssuance(makeNcr(), ['orig@test.com'], 'http://app/ncrs/1');
    capturedHtml().should.include('Origin Person');
  });

  it('body states NCR was approved by all members and asks to execute disposition', async () => {
    await sendIssuance(makeNcr(), ['orig@test.com'], 'http://app/ncrs/1');
    const html = capturedHtml();
    html.should.include('approved by all associated members');
    html.should.include('execute the parts');
    html.should.include('close out the report');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendIssuance(makeNcr(), ['orig@test.com'], 'http://app/ncrs/3');
    capturedHtml().should.include('href="http://app/ncrs/3"');
  });

  it('omits the link when ncrUrl is absent', async () => {
    await sendIssuance(makeNcr(), ['orig@test.com']);
    capturedHtml().should.not.include('href=');
  });
});

describe('lib/ncr-email — sendFinalDistribution format (spec email 7)', () => {
  it('uses the correct subject line', async () => {
    await sendFinalDistribution(makeNcr(), ['a@test.com'], 'http://app/ncrs/1');
    capturedSubject().should.equal('NCR NCR-2026-0001 — Closed');
  });

  it('body states the NCR has been closed and includes part and supplier', async () => {
    await sendFinalDistribution(makeNcr(), ['a@test.com'], 'http://app/ncrs/1');
    const html = capturedHtml();
    html.should.include('NCR-2026-0001');
    html.should.include('Bracket');
    html.should.include('Acme');
    html.should.include('closed');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendFinalDistribution(makeNcr(), ['a@test.com'], 'http://app/ncrs/11');
    capturedHtml().should.include('href="http://app/ncrs/11"');
  });

  it('omits the link when ncrUrl is absent', async () => {
    await sendFinalDistribution(makeNcr(), ['a@test.com']);
    capturedHtml().should.not.include('href=');
  });
});

describe('lib/ncr-email — sendDesignateAssigned format', () => {
  it('uses the correct subject line', async () => {
    await sendDesignateAssigned(makeNcr(), 'designate@test.com', 'http://app/ncrs/1');
    capturedSubject().should.equal('You Have Been Assigned as Designate — NCR NCR-2026-0001');
  });

  it('body mentions the originator, part, supplier and designate authority', async () => {
    await sendDesignateAssigned(makeNcr(), 'designate@test.com', 'http://app/ncrs/1');
    const html = capturedHtml();
    html.should.include('Origin Person');
    html.should.include('Bracket');
    html.should.include('Acme');
    html.should.include('Designate');
  });

  it('includes an NCR link when ncrUrl is provided', async () => {
    await sendDesignateAssigned(makeNcr(), 'designate@test.com', 'http://app/ncrs/8');
    capturedHtml().should.include('href="http://app/ncrs/8"');
  });

  it('omits the link when ncrUrl is absent', async () => {
    await sendDesignateAssigned(makeNcr(), 'designate@test.com', '');
    capturedHtml().should.not.include('href=');
  });
});
