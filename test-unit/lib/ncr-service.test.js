const mongoose = require('mongoose');
const sinon = require('sinon');
require('chai').should();

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

if (!mongoose.modelNames().includes('User')) {
  mongoose.model('User', new mongoose.Schema({ _id: String, name: String, email: String, roles: [String] }));
}

if (!mongoose.modelNames().includes('Group')) {
  mongoose.model('Group', new mongoose.Schema({ _id: String, members: [{ type: String, ref: 'User' }] }));
}

// Stub ncr-email functions on the module exports *before* loading lib/ncr-service
// so that the destructured locals inside ncr-service.js pick up the stubs.
const ncrEmailModule = require('../../lib/ncr-email');
const sendInitialNotificationStub = sinon.stub(ncrEmailModule, 'sendInitialNotification').resolves({ results: [], cc: [] });
const sendDispositionRequestStub = sinon.stub(ncrEmailModule, 'sendDispositionRequest').resolves({ results: [], cc: [] });
sinon.stub(ncrEmailModule, 'sendQaNotification').resolves([]);
sinon.stub(ncrEmailModule, 'sendApprovalRequest').resolves([]);
const sendIssuanceStub = sinon.stub(ncrEmailModule, 'sendIssuance').resolves([]);
const sendFinalDistributionStub = sinon.stub(ncrEmailModule, 'sendFinalDistribution').resolves([]);
sinon.stub(ncrEmailModule, 'sendPaAssigned').resolves([]);
const sendDesignateAssignedStub = sinon.stub(ncrEmailModule, 'sendDesignateAssigned').resolves([]);

delete require.cache[require.resolve('../../lib/ncr-service.js')];
const {
  createNcr,
  submitDisposition,
  submitConcurrence,
  submitApproval,
  returnForComment,
  qaResubmit,
  closeNcr,
  assignDesignate,
  removeDesignate,
  listNcrs,
  getNcrById,
  assignPaOwner,
  updatePaStatus,
  closePa,
} = require('../../lib/ncr-service.js');

const { Ncr } = require('../../model/ncr');
const User = mongoose.model('User');
const Group = mongoose.model('Group');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return { id: 'user1', name: 'Alice', email: 'alice@test.com', roles: [], ...overrides };
}

function newNcr(overrides = {}) {
  return new Ncr({
    ncr_number: 'NCR-2026-0001',
    originator_id: 'orig1',
    originator_name: 'Origin Person',
    wbs_number: 'WBS-1',
    part_name: 'Bracket',
    part_number: 'BA-1',
    status: 'Submitted',
    ...overrides,
  });
}

function minimalNcrData(overrides = {}) {
  return {
    part_name: 'Bracket',
    part_number: 'BA-1',
    part_revision: 'A',
    quantity: 2,
    supplier_name: 'Acme',
    wbs_number: 'WBS-1',
    specification_drawing_reference: 'DWG-1',
    description_of_nonconformance: 'Crack found on surface, needs review',
    discovery_date: new Date(),
    discovery_context: 'incoming_inspection',
    ...overrides,
  };
}

function validOwnerData(overrides = {}) {
  return {
    owner_id: 'owner1',
    owner_name: 'Owner One',
    owner_email: 'owner1@test.com',
    target_completion_date: new Date(),
    ...overrides,
  };
}

function stubFindById(doc) {
  return sinon.stub(Ncr, 'findById').resolves(doc);
}

function stubFindByIdLean(doc) {
  return sinon.stub(Ncr, 'findById').returns({ lean: () => Promise.resolve(doc) });
}

function stubNcrFind(docs) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: () => Promise.resolve(docs),
  };
  return sinon.stub(Ncr, 'find').returns(chain);
}

function stubUserFind(results) {
  return sinon.stub(User, 'find').returns({ lean: () => Promise.resolve(results) });
}

function stubGroupFindOne(result) {
  const chain = { populate: function() { return chain; }, lean: () => Promise.resolve(result) };
  Group.findOne.returns(chain);
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
  sinon.stub(Ncr.prototype, 'save').resolves();
  // Default: ncr-qa group not configured — no user is a QA staff member
  const nullChain = { populate: function() { return nullChain; }, lean: () => Promise.resolve(null) };
  sinon.stub(Group, 'findOne').returns(nullChain);
});

afterEach(() => {
  sinon.restore();
});

// ── createNcr ────────────────────────────────────────────────────────────────

describe('lib/ncr-service — createNcr', () => {
  it('creates an NCR with an auto-generated number starting at 0001 when none exist', async () => {
    sinon.stub(Ncr, 'findOne').resolves(null);
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    const year = new Date().getFullYear();

    const ncr = await createNcr(minimalNcrData(), makeUser());

    ncr.ncr_number.should.equal(`NCR-${year}-0001`);
    ncr.status.should.equal('Submitted');
    ncr.events.some(e => e.event_type === 'ncr.submitted').should.be.true;
    ncr.events.some(e => e.event_type === 'notification.initial').should.be.true;
    ncr.events.some(e => e.event_type === 'notification.disposition_request').should.be.false;
  });

  it('increments the sequence based on the last NCR number for the year', async () => {
    const year = new Date().getFullYear();
    sinon.stub(Ncr, 'findOne').resolves({ ncr_number: `NCR-${year}-0007` });
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });

    const ncr = await createNcr(minimalNcrData(), makeUser());

    ncr.ncr_number.should.equal(`NCR-${year}-0008`);
  });

  it('sends initial notification to QA staff from the ncr-qa group, not the submitter', async () => {
    sinon.stub(Ncr, 'findOne').resolves(null);
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@org.com' }] });

    await createNcr(minimalNcrData(), makeUser({ email: 'submitter@caller.com' }));

    const emailArg = sendInitialNotificationStub.lastCall.args[1];
    emailArg.should.deep.equal(['qa@org.com']);
  });

  it('sends a disposition-request notification when ce_cs_id is provided', async () => {
    sinon.stub(Ncr, 'findOne').resolves(null);
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    const data = minimalNcrData({ ce_cs_id: 'ces1', ce_cs_email: 'ces@test.com' });

    const ncr = await createNcr(data, makeUser());

    ncr.events.some(e => e.event_type === 'notification.disposition_request').should.be.true;
  });

  it('sends no email at all when the ncr-qa group is not configured, even when ce_cs_email is provided', async () => {
    sinon.stub(Ncr, 'findOne').resolves(null);
    // beforeEach's default Group.findOne stub already resolves to null (no group).
    // sendDispositionRequestStub/sendInitialNotificationStub are shared, module-level
    // stubs (not re-created per test), so reset their call history before asserting.
    sendDispositionRequestStub.resetHistory();
    sendInitialNotificationStub.resetHistory();
    const data = minimalNcrData({ ce_cs_id: 'ces1', ce_cs_email: 'ces@test.com' });

    await expectRejection(createNcr(data, makeUser()), 500);

    sendDispositionRequestStub.called.should.be.false;
    sendInitialNotificationStub.called.should.be.false;
    Ncr.prototype.save.called.should.be.false;
  });

  it('stores a traveler_link when traveler_id is provided', async () => {
    sinon.stub(Ncr, 'findOne').resolves(null);
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    const data = minimalNcrData({ traveler_id: 'trav1', traveler_step_number: 3 });

    const ncr = await createNcr(data, makeUser());

    ncr.traveler_link.initiated_from_traveler.should.be.true;
    ncr.traveler_link.step_number.should.equal(3);
  });
});

// ── submitDisposition ────────────────────────────────────────────────────────

describe('lib/ncr-service — submitDisposition', () => {
  const user = makeUser({ id: 'ces1', name: 'CE Person' });

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(submitDisposition('id1', {}, user), 404);
  });

  it('throws 403 when user is not the assigned CE/CS', async () => {
    stubFindById(newNcr({ status: 'Submitted', ce_cs_id: 'someoneElse' }));
    await expectRejection(submitDisposition('id1', {}, user), 403);
  });

  it('throws 409 when NCR is not in Submitted status', async () => {
    stubFindById(newNcr({ status: 'Dispositioned', ce_cs_id: 'ces1' }));
    await expectRejection(submitDisposition('id1', {}, user), 409);
  });

  it('submits a Rework disposition, sets preventive actions, and transitions to Dispositioned', async () => {
    stubFindById(newNcr({ status: 'Submitted', ce_cs_id: 'ces1' }));
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });

    const data = {
      parts_disposition: 'Rework',
      rework_repair_instructions: 'Detailed rework instructions exceeding fifty characters for validation',
      preventive_actions: ['Update work instruction', 'Retrain operator'],
    };

    const result = await submitDisposition('id1', data, user);

    result.status.should.equal('Dispositioned');
    result.disposition.parts_disposition.should.equal('Rework');
    result.disposition.rework_repair_instructions.should.equal(data.rework_repair_instructions);
    result.preventive_actions.should.have.lengthOf(2);
    result.preventive_actions[0].status.should.equal('Open');
    result.events.some(e => e.event_type === 'disposition.submitted').should.be.true;
    result.events.some(e => e.event_type === 'notification.qa_notification').should.be.true;
  });

  it('succeeds without root_cause_documentation (field removed from disposition)', async () => {
    stubFindById(newNcr({ status: 'Submitted', ce_cs_id: 'ces1' }));
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });

    const data = {
      parts_disposition: 'Use-As-Is',
      preventive_actions: ['Preventive action description exceeding fifty characters for validation purposes.'],
    };

    const result = await submitDisposition('id1', data, user);

    result.status.should.equal('Dispositioned');
    (result.disposition.root_cause_documentation === undefined).should.be.true;
  });

  it('succeeds with zero preventive actions (field no longer required)', async () => {
    stubFindById(newNcr({ status: 'Submitted', ce_cs_id: 'ces1' }));
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });

    const data = {
      parts_disposition: 'Use-As-Is',
      preventive_actions: [],
    };

    const result = await submitDisposition('id1', data, user);

    result.status.should.equal('Dispositioned');
    result.preventive_actions.should.have.lengthOf(0);
  });

  it('succeeds when preventive_actions is omitted entirely', async () => {
    stubFindById(newNcr({ status: 'Submitted', ce_cs_id: 'ces1' }));
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });

    const data = {
      parts_disposition: 'Use-As-Is',
    };

    const result = await submitDisposition('id1', data, user);

    result.status.should.equal('Dispositioned');
    result.preventive_actions.should.have.lengthOf(0);
  });

  it('does not require rework_repair_instructions for a Use-As-Is disposition', async () => {
    stubFindById(newNcr({ status: 'Submitted', ce_cs_id: 'ces1' }));
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });

    const data = {
      parts_disposition: 'Use-As-Is',
      preventive_actions: ['Update work instruction'],
    };

    const result = await submitDisposition('id1', data, user);

    (result.disposition.rework_repair_instructions === undefined).should.be.true;
    result.events.some(e => e.event_type === 'notification.qa_notification').should.be.true;
  });
});

// ── submitConcurrence ────────────────────────────────────────────────────────

describe('lib/ncr-service — submitConcurrence', () => {
  const qaUser = makeUser({ id: 'qa1', name: 'QA Person', roles: ['qa_staff'] });

  it('throws 403 when user is not QA Staff', async () => {
    await expectRejection(submitConcurrence('id1', [], makeUser({ roles: [] })), 403);
  });

  it('throws 404 when NCR not found', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });
    stubFindById(null);
    await expectRejection(submitConcurrence('id1', [], qaUser), 404);
  });

  it('throws 409 when NCR is not Dispositioned', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });
    stubFindById(newNcr({ status: 'Submitted' }));
    await expectRejection(submitConcurrence('id1', [], qaUser), 409);
  });

  it('transitions directly to Final Approval and sends issuance email when no additional approvers', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });
    stubFindById(newNcr({ status: 'Dispositioned', originator_id: 'orig1' }));
    stubUserFind([{ _id: 'orig1', name: 'Origin', email: 'orig@test.com' }]);

    const result = await submitConcurrence('id1', [], qaUser);

    result.status.should.equal('Final Approval');
    result.qa_staff_identity.should.equal('qa1');
    result.events.some(e => e.event_type === 'qa.concurred').should.be.true;
    result.events.some(e => e.event_type === 'notification.issuance').should.be.true;
  });

  it('includes the Designate\'s email in the issuance send when one is assigned', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });
    stubFindById(newNcr({ status: 'Dispositioned', originator_id: 'orig1', originator_designate_id: 'des1' }));
    stubUserFind([
      { _id: 'orig1', name: 'Origin', email: 'orig@test.com' },
      { _id: 'des1', name: 'Designate', email: 'des@test.com' },
    ]);

    await submitConcurrence('id1', [], qaUser);

    const emails = sendIssuanceStub.lastCall.args[1];
    emails.should.include('orig@test.com');
    emails.should.include('des@test.com');
  });

  it('transitions to Approved and requests approval from designated approvers', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] });
    stubFindById(newNcr({ status: 'Dispositioned' }));
    stubUserFind([{ _id: 'appr1', name: 'Approver One', email: 'a1@test.com' }]);

    const result = await submitConcurrence(
      'id1',
      [{ approver_id: 'appr1', approver_role: 'Manager' }],
      qaUser
    );

    result.status.should.equal('Approved');
    result.additional_approvers.should.have.lengthOf(1);
    result.additional_approvers[0].approval_status.should.equal('Pending');
    result.events.some(e => e.event_type === 'approvers.designated').should.be.true;
    result.events.some(e => e.event_type === 'notification.approval_request').should.be.true;
  });
});

// ── submitApproval ───────────────────────────────────────────────────────────

describe('lib/ncr-service — submitApproval', () => {
  const approver = makeUser({ id: 'appr1', name: 'Approver One' });

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(submitApproval('id1', approver), 404);
  });

  it('throws 409 when NCR is not Approved', async () => {
    stubFindById(newNcr({ status: 'Dispositioned' }));
    await expectRejection(submitApproval('id1', approver), 409);
  });

  it('throws 403 when user is not a designated approver', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      additional_approvers: [{ approver_id: 'someoneElse', approval_status: 'Pending' }],
    }));
    await expectRejection(submitApproval('id1', approver), 403);
  });

  it('throws 409 when the approver has already approved', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      additional_approvers: [{ approver_id: 'appr1', approval_status: 'Approved' }],
    }));
    await expectRejection(submitApproval('id1', approver), 409);
  });

  it('stays Approved and sends no issuance when other approvers are still pending', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      additional_approvers: [
        { approver_id: 'appr1', approval_status: 'Pending' },
        { approver_id: 'appr2', approval_status: 'Pending' },
      ],
    }));

    const result = await submitApproval('id1', approver);

    result.status.should.equal('Approved');
    result.additional_approvers[0].approval_status.should.equal('Approved');
    result.events.some(e => e.event_type === 'notification.issuance').should.be.false;
  });

  it('transitions to Final Approval and sends issuance when all approvers have approved', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      originator_id: 'orig1',
      additional_approvers: [{ approver_id: 'appr1', approval_status: 'Pending' }],
    }));
    stubUserFind([{ _id: 'orig1', name: 'Origin', email: 'orig@test.com' }]);

    const result = await submitApproval('id1', approver);

    result.status.should.equal('Final Approval');
    result.events.some(e => e.event_type === 'notification.issuance').should.be.true;
  });

  it('includes the Designate\'s email in the issuance send when one is assigned', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      originator_id: 'orig1',
      originator_designate_id: 'des1',
      additional_approvers: [{ approver_id: 'appr1', approval_status: 'Pending' }],
    }));
    stubUserFind([
      { _id: 'orig1', name: 'Origin', email: 'orig@test.com' },
      { _id: 'des1', name: 'Designate', email: 'des@test.com' },
    ]);

    await submitApproval('id1', approver);

    const emails = sendIssuanceStub.lastCall.args[1];
    emails.should.include('orig@test.com');
    emails.should.include('des@test.com');
  });
});

// ── returnForComment ─────────────────────────────────────────────────────────

describe('lib/ncr-service — returnForComment', () => {
  const approver = makeUser({ id: 'appr1' });

  it('throws 400 when comments are missing', async () => {
    await expectRejection(returnForComment('id1', '  ', approver), 400);
  });

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(returnForComment('id1', 'concerns', approver), 404);
  });

  it('throws 409 when NCR is not Approved', async () => {
    stubFindById(newNcr({ status: 'Dispositioned' }));
    await expectRejection(returnForComment('id1', 'concerns', approver), 409);
  });

  it('throws 403 when user is not a designated approver', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      additional_approvers: [{ approver_id: 'someoneElse', approval_status: 'Pending' }],
    }));
    await expectRejection(returnForComment('id1', 'concerns', approver), 403);
  });

  it('transitions to Returned for Comment and notifies QA Staff', async () => {
    stubFindById(newNcr({
      status: 'Approved',
      additional_approvers: [{ approver_id: 'appr1', approval_status: 'Pending' }],
    }));
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });

    const result = await returnForComment('id1', 'Disagree with rework plan', approver);

    result.status.should.equal('Returned for Comment');
    result.additional_approvers[0].comments.should.equal('Disagree with rework plan');
    result.events.some(e => e.event_type === 'approval.returned_for_comment').should.be.true;
  });
});

// ── qaResubmit ───────────────────────────────────────────────────────────────

describe('lib/ncr-service — qaResubmit', () => {
  const qaUser = makeUser({ id: 'qa1', roles: ['qa_staff'] });

  it('throws 403 when user is not QA Staff', async () => {
    await expectRejection(qaResubmit('id1', makeUser({ roles: [] })), 403);
  });

  it('throws 404 when NCR not found', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(null);
    await expectRejection(qaResubmit('id1', qaUser), 404);
  });

  it('throws 409 when NCR is not Returned for Comment', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(newNcr({ status: 'Approved' }));
    await expectRejection(qaResubmit('id1', qaUser), 409);
  });

  it('resets returned approvers to Pending and re-requests their approval', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(newNcr({
      status: 'Returned for Comment',
      additional_approvers: [
        { approver_id: 'appr1', approval_status: 'Returned for Comment' },
        { approver_id: 'appr2', approval_status: 'Approved' },
      ],
    }));
    stubUserFind([{ _id: 'appr1', name: 'Approver One', email: 'a1@test.com' }]);

    const result = await qaResubmit('id1', qaUser);

    result.status.should.equal('Approved');
    result.additional_approvers[0].approval_status.should.equal('Pending');
    result.additional_approvers[1].approval_status.should.equal('Approved');
    result.events.some(e => e.event_type === 'qa.resubmitted').should.be.true;
    result.events.some(e => e.event_type === 'notification.approval_request').should.be.true;
  });
});

// ── closeNcr ─────────────────────────────────────────────────────────────────

describe('lib/ncr-service — closeNcr', () => {
  const originator = makeUser({ id: 'orig1' });

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(closeNcr('id1', {}, originator), 404);
  });

  it('throws 403 when user is not the originator', async () => {
    stubFindById(newNcr({ status: 'Final Approval', originator_id: 'someoneElse' }));
    await expectRejection(closeNcr('id1', {}, originator), 403);
  });

  it('throws 409 when NCR is not in Final Approval status', async () => {
    stubFindById(newNcr({ status: 'Approved', originator_id: 'orig1' }));
    await expectRejection(closeNcr('id1', { closure_notes: 'x'.repeat(30) }, originator), 409);
  });

  it('throws 400 when closure_notes is missing', async () => {
    stubFindById(newNcr({ status: 'Final Approval', originator_id: 'orig1' }));
    await expectRejection(closeNcr('id1', {}, originator), 400);
  });

  it('throws 400 when closure_notes is empty/whitespace', async () => {
    stubFindById(newNcr({ status: 'Final Approval', originator_id: 'orig1' }));
    await expectRejection(closeNcr('id1', { closure_notes: '   ' }, originator), 400);
  });

  it('accepts closure_notes of any non-empty length (no minimum character requirement)', async () => {
    stubFindById(newNcr({
      status: 'Final Approval',
      originator_id: 'orig1',
      ce_cs_id: 'ces1',
      qa_staff_identity: 'qa1',
    }));
    stubUserFind([
      { _id: 'orig1', name: 'Origin', email: 'orig@test.com' },
      { _id: 'ces1', name: 'CES', email: 'ces@test.com' },
      { _id: 'qa1', name: 'QA', email: 'qa@test.com' },
    ]);

    const result = await closeNcr('id1', { closure_notes: 'ok' }, originator);

    result.status.should.equal('Closed');
    result.closure_record.closure_notes.should.equal('ok');
  });

  it('throws 400 when a Traveler-linked NCR is closed without traveler_signed_off', async () => {
    stubFindById(newNcr({
      status: 'Final Approval',
      originator_id: 'orig1',
      traveler_link: { traveler_id: 'trav1', step_number: 2, initiated_from_traveler: true },
    }));

    await expectRejection(closeNcr('id1', { closure_notes: 'x'.repeat(30) }, originator), 400);
  });

  it('closes a standalone NCR and sends final distribution', async () => {
    stubFindById(newNcr({
      status: 'Final Approval',
      originator_id: 'orig1',
      ce_cs_id: 'ces1',
      qa_staff_identity: 'qa1',
    }));
    stubUserFind([
      { _id: 'orig1', name: 'Origin', email: 'orig@test.com' },
      { _id: 'ces1', name: 'CES', email: 'ces@test.com' },
      { _id: 'qa1', name: 'QA', email: 'qa@test.com' },
    ]);

    const result = await closeNcr(
      'id1',
      { closure_notes: 'Rework completed and verified thoroughly' },
      originator
    );

    result.status.should.equal('Closed');
    result.closure_record.closure_notes.should.equal('Rework completed and verified thoroughly');
    result.events.some(e => e.event_type === 'ncr.closed').should.be.true;
    result.events.some(e => e.event_type === 'traveler.signed_off').should.be.false;
    result.events.some(e => e.event_type === 'notification.final_distribution').should.be.true;
  });

  it('closes a Traveler-linked NCR and records the traveler.signed_off event when signed off', async () => {
    stubFindById(newNcr({
      status: 'Final Approval',
      originator_id: 'orig1',
      traveler_link: { traveler_id: 'trav1', step_number: 2, initiated_from_traveler: true },
    }));
    stubUserFind([{ _id: 'orig1', name: 'Origin', email: 'orig@test.com' }]);

    const result = await closeNcr(
      'id1',
      { closure_notes: 'Signed off in traveler and verified', traveler_signed_off: true },
      originator
    );

    result.status.should.equal('Closed');
    result.closure_record.traveler_signed_off.should.be.true;
    result.events.some(e => e.event_type === 'traveler.signed_off').should.be.true;
  });

  it('allows the Designate (not just the Originator) to close the NCR', async () => {
    const designate = makeUser({ id: 'des1', name: 'Des Person' });
    stubFindById(newNcr({ status: 'Final Approval', originator_id: 'orig1', originator_designate_id: 'des1' }));
    stubUserFind([{ _id: 'orig1', name: 'Origin', email: 'orig@test.com' }]);

    const result = await closeNcr('id1', { closure_notes: 'Closed by the Designate, verified' }, designate);

    result.status.should.equal('Closed');
  });

  it('records the Designate\'s own identity as the closer, not the Originator\'s', async () => {
    const designate = makeUser({ id: 'des1', name: 'Des Person' });
    stubFindById(newNcr({ status: 'Final Approval', originator_id: 'orig1', originator_designate_id: 'des1' }));
    stubUserFind([{ _id: 'orig1', name: 'Origin', email: 'orig@test.com' }]);

    const result = await closeNcr('id1', { closure_notes: 'Closed by the Designate, verified' }, designate);

    result.closure_record.closed_by.should.equal('des1');
    result.closure_record.closed_by_name.should.equal('Des Person');
    const closedEvent = result.events.find(e => e.event_type === 'ncr.closed');
    closedEvent.actor_id.should.equal('des1');
  });

  it('includes the Designate\'s email in the final-distribution send when one is assigned', async () => {
    stubFindById(newNcr({
      status: 'Final Approval',
      originator_id: 'orig1',
      originator_designate_id: 'des1',
    }));
    stubUserFind([
      { _id: 'orig1', name: 'Origin', email: 'orig@test.com' },
      { _id: 'des1', name: 'Designate', email: 'des@test.com' },
    ]);

    await closeNcr('id1', { closure_notes: 'Closed with a Designate assigned, verified' }, originator);

    const emails = sendFinalDistributionStub.lastCall.args[1];
    emails.should.include('des@test.com');
  });
});

// ── assignDesignate ─────────────────────────────────────────────────────────

describe('lib/ncr-service — assignDesignate', () => {
  const originator = makeUser({ id: 'orig1' });
  const validDesignateData = { designate_id: 'des1', designate_name: 'Des Person', designate_email: 'des@test.com' };

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(assignDesignate('id1', validDesignateData, originator), 404);
  });

  it('throws 403 when caller is not the originator', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'someoneElse' }));
    await expectRejection(assignDesignate('id1', validDesignateData, originator), 403);
  });

  it('throws 403 when caller is the current Designate, not the Originator', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'someoneElse', originator_designate_id: 'orig1' }));
    await expectRejection(assignDesignate('id1', validDesignateData, originator), 403);
  });

  it('throws 400 when designate_id, designate_name, or designate_email is missing', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'orig1' }));
    await expectRejection(assignDesignate('id1', { designate_id: 'des1' }, originator), 400);
  });

  it('throws 400 when assigning the Originator as their own Designate', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'orig1' }));
    await expectRejection(
      assignDesignate('id1', { designate_id: 'orig1', designate_name: 'Origin', designate_email: 'orig@test.com' }, originator),
      400
    );
  });

  it('throws 409 when the NCR is Closed', async () => {
    stubFindById(newNcr({ status: 'Closed', originator_id: 'orig1' }));
    await expectRejection(assignDesignate('id1', validDesignateData, originator), 409);
  });

  it('assigns a Designate, records a delegate.assigned event, and notifies the Designate', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'orig1' }));

    const result = await assignDesignate('id1', validDesignateData, originator);

    result.originator_designate_id.should.equal('des1');
    result.originator_designate_name.should.equal('Des Person');
    const event = result.events.find(e => e.event_type === 'delegate.assigned');
    event.should.exist;
    event.actor_id.should.equal('orig1');
    event.payload.designate_id.should.equal('des1');
    result.events.some(e => e.event_type === 'notification.designate_assigned').should.be.true;
    sendDesignateAssignedStub.lastCall.args[1].should.equal('des@test.com');
  });

  it('replaces an existing Designate when assigning a different one', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'orig1', originator_designate_id: 'old1', originator_designate_name: 'Old Person' }));

    const result = await assignDesignate('id1', validDesignateData, originator);

    result.originator_designate_id.should.equal('des1');
    result.originator_designate_name.should.equal('Des Person');
  });
});

// ── removeDesignate ──────────────────────────────────────────────────────────

describe('lib/ncr-service — removeDesignate', () => {
  const originator = makeUser({ id: 'orig1' });

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(removeDesignate('id1', originator), 404);
  });

  it('throws 403 when caller is not the originator', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'someoneElse', originator_designate_id: 'orig1' }));
    await expectRejection(removeDesignate('id1', originator), 403);
  });

  it('throws 409 when the NCR is Closed', async () => {
    stubFindById(newNcr({ status: 'Closed', originator_id: 'orig1', originator_designate_id: 'des1' }));
    await expectRejection(removeDesignate('id1', originator), 409);
  });

  it('clears the Designate and records a delegate.removed event with the outgoing identity', async () => {
    stubFindById(newNcr({
      status: 'Submitted',
      originator_id: 'orig1',
      originator_designate_id: 'des1',
      originator_designate_name: 'Des Person',
    }));

    const result = await removeDesignate('id1', originator);

    (result.originator_designate_id === undefined || result.originator_designate_id === null).should.be.true;
    (result.originator_designate_name === undefined || result.originator_designate_name === null).should.be.true;
    const event = result.events.find(e => e.event_type === 'delegate.removed');
    event.should.exist;
    event.payload.previous_designate_id.should.equal('des1');
    event.payload.previous_designate_name.should.equal('Des Person');
  });

  it('succeeds (no-op removal) even when no Designate was assigned', async () => {
    stubFindById(newNcr({ status: 'Submitted', originator_id: 'orig1' }));

    const result = await removeDesignate('id1', originator);

    const event = result.events.find(e => e.event_type === 'delegate.removed');
    event.should.exist;
    (event.payload.previous_designate_id === undefined || event.payload.previous_designate_id === null).should.be.true;
  });
});

// ── listNcrs ─────────────────────────────────────────────────────────────────

describe('lib/ncr-service — listNcrs', () => {
  it('excludes Closed NCRs by default and computes days_elapsed', async () => {
    const docs = [{ _id: '1', ncr_number: 'NCR-2026-0001', created_at: new Date(Date.now() - 5 * 86400000) }];
    const findStub = stubNcrFind(docs);
    sinon.stub(Ncr, 'countDocuments').resolves(1);

    const result = await listNcrs({}, makeUser({ id: 'orig1', roles: [] }));

    result.total.should.equal(1);
    result.ncrs.should.have.lengthOf(1);
    result.ncrs[0].days_elapsed.should.equal(5);
    findStub.firstCall.args[0].status.should.deep.equal({ $ne: 'Closed' });
  });

  it('includes Closed NCRs when includeClosed=true', async () => {
    const findStub = stubNcrFind([]);
    sinon.stub(Ncr, 'countDocuments').resolves(0);

    await listNcrs({ includeClosed: true }, makeUser({ roles: ['manager'] }));

    findStub.firstCall.args[0].should.not.have.property('status');
  });

  it('scopes results to the originator when the user has no elevated role', async () => {
    const findStub = stubNcrFind([]);
    sinon.stub(Ncr, 'countDocuments').resolves(0);

    await listNcrs({}, makeUser({ id: 'orig1', roles: [] }));

    const query = findStub.firstCall.args[0];
    query.$or.should.deep.include({ originator_id: 'orig1' });
  });

  it('also scopes results to NCRs where the user is the Designate', async () => {
    const findStub = stubNcrFind([]);
    sinon.stub(Ncr, 'countDocuments').resolves(0);

    await listNcrs({}, makeUser({ id: 'des1', roles: [] }));

    const query = findStub.firstCall.args[0];
    query.$or.should.deep.include({ originator_designate_id: 'des1' });
  });

  it('also scopes results to NCRs where the user is the assigned CE/CS, regardless of their roles', async () => {
    const findStub = stubNcrFind([]);
    sinon.stub(Ncr, 'countDocuments').resolves(0);

    await listNcrs({}, makeUser({ id: 'ces1', roles: [] }));

    const query = findStub.firstCall.args[0];
    query.$or.should.deep.include({ ce_cs_id: 'ces1' });
  });

  it('does not scope results for managers', async () => {
    const findStub = stubNcrFind([]);
    sinon.stub(Ncr, 'countDocuments').resolves(0);

    await listNcrs({}, makeUser({ roles: ['manager'] }));

    findStub.firstCall.args[0].should.not.have.property('$or');
  });
});

// ── getNcrById ───────────────────────────────────────────────────────────────

describe('lib/ncr-service — getNcrById', () => {
  it('throws 404 when NCR not found', async () => {
    stubFindByIdLean(null);
    await expectRejection(getNcrById('id1', makeUser()), 404);
  });

  it('allows managers to access any NCR', async () => {
    stubFindByIdLean({ originator_id: 'someoneElse', status: 'Submitted' });

    const result = await getNcrById('id1', makeUser({ roles: ['manager'] }));

    result.status.should.equal('Submitted');
  });

  it('allows the originator to access their own NCR', async () => {
    stubFindByIdLean({ originator_id: 'orig1', status: 'Submitted' });

    const result = await getNcrById('id1', makeUser({ id: 'orig1', roles: [] }));

    result.originator_id.should.equal('orig1');
  });

  it('throws 403 when the user has no relationship to the NCR', async () => {
    stubFindByIdLean({
      originator_id: 'someoneElse',
      status: 'Submitted',
      additional_approvers: [],
      preventive_actions: [],
    });

    await expectRejection(getNcrById('id1', makeUser({ id: 'orig1', roles: [] })), 403);
  });

  it('allows the Designate to access the NCR they are assigned to', async () => {
    stubFindByIdLean({
      originator_id: 'orig1',
      originator_designate_id: 'des1',
      status: 'Submitted',
      additional_approvers: [],
      preventive_actions: [],
    });

    const result = await getNcrById('id1', makeUser({ id: 'des1', roles: [] }));

    result.originator_designate_id.should.equal('des1');
  });

  it('denies access to a Designate on a different, unrelated NCR', async () => {
    stubFindByIdLean({
      originator_id: 'someoneElse',
      originator_designate_id: 'someoneElsesDesignate',
      status: 'Submitted',
      additional_approvers: [],
      preventive_actions: [],
    });

    await expectRejection(getNcrById('id1', makeUser({ id: 'des1', roles: [] })), 403);
  });

  it('allows the assigned CE/CS to access the NCR, regardless of their roles', async () => {
    stubFindByIdLean({
      originator_id: 'orig1',
      ce_cs_id: 'ces1',
      status: 'Submitted',
      additional_approvers: [],
      preventive_actions: [],
    });

    const result = await getNcrById('id1', makeUser({ id: 'ces1', roles: [] }));

    result.ce_cs_id.should.equal('ces1');
  });
});

// ── assignPaOwner ────────────────────────────────────────────────────────────

describe('lib/ncr-service — assignPaOwner', () => {
  const qaUser = makeUser({ id: 'qa1', roles: ['qa_staff'] });

  it('throws 403 when user is not QA Staff', async () => {
    await expectRejection(assignPaOwner('id1', 'pa1', {}, makeUser({ roles: [] })), 403);
  });

  it('throws 400 when required owner fields are missing', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    await expectRejection(assignPaOwner('id1', 'pa1', { owner_id: 'u1' }, qaUser), 400);
  });

  it('throws 404 when NCR not found', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(null);
    await expectRejection(assignPaOwner('id1', 'pa1', validOwnerData(), qaUser), 404);
  });

  it('throws 404 when the preventive action is not found', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(newNcr({ preventive_actions: [] }));
    const missingId = new mongoose.Types.ObjectId().toString();
    await expectRejection(assignPaOwner('id1', missingId, validOwnerData(), qaUser), 404);
  });

  it('assigns an owner, appends an event, and notifies the owner', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    const ncr = newNcr({ preventive_actions: [{ action_description: 'Update work instruction', status: 'Open' }] });
    stubFindById(ncr);
    const paId = ncr.preventive_actions[0]._id.toString();

    const result = await assignPaOwner('id1', paId, validOwnerData(), qaUser);

    const pa = result.preventive_actions.id(paId);
    pa.owner_id.should.equal('owner1');
    pa.owner_name.should.equal('Owner One');
    result.events.some(e => e.event_type === 'pa.owner_assigned').should.be.true;
  });
});

// ── updatePaStatus ───────────────────────────────────────────────────────────

describe('lib/ncr-service — updatePaStatus', () => {
  const qaUser = makeUser({ id: 'qa1', roles: ['qa_staff'] });

  it('throws 400 for an invalid status value', async () => {
    await expectRejection(updatePaStatus('id1', 'pa1', { status: 'Bogus' }, qaUser), 400);
  });

  it('throws 404 when NCR not found', async () => {
    stubFindById(null);
    await expectRejection(updatePaStatus('id1', 'pa1', { status: 'In Progress' }, qaUser), 404);
  });

  it('throws 404 when the preventive action is not found', async () => {
    stubFindById(newNcr({ preventive_actions: [] }));
    const missingId = new mongoose.Types.ObjectId().toString();
    await expectRejection(updatePaStatus('id1', missingId, { status: 'In Progress' }, qaUser), 404);
  });

  it('throws 403 when the caller is neither the owner nor QA Staff', async () => {
    const ncr = newNcr({ preventive_actions: [{ action_description: 'x', status: 'Open', owner_id: 'owner1' }] });
    stubFindById(ncr);
    const paId = ncr.preventive_actions[0]._id.toString();

    await expectRejection(
      updatePaStatus('id1', paId, { status: 'In Progress' }, makeUser({ id: 'other', roles: [] })),
      403
    );
  });

  it('allows the PA owner to update status and appends a status_history entry', async () => {
    const ncr = newNcr({ preventive_actions: [{ action_description: 'x', status: 'Open', owner_id: 'owner1' }] });
    stubFindById(ncr);
    const paId = ncr.preventive_actions[0]._id.toString();

    const result = await updatePaStatus(
      'id1',
      paId,
      { status: 'In Progress', comment: 'Started work' },
      makeUser({ id: 'owner1', roles: [] })
    );

    const pa = result.preventive_actions.id(paId);
    pa.status.should.equal('In Progress');
    pa.status_history.should.have.lengthOf(1);
    pa.comments.should.include('Started work');
    result.events.some(e => e.event_type === 'pa.status_updated').should.be.true;
  });
});

// ── closePa ──────────────────────────────────────────────────────────────────

describe('lib/ncr-service — closePa', () => {
  const qaUser = makeUser({ id: 'qa1', roles: ['qa_staff'] });

  it('throws 403 when user is not QA Staff', async () => {
    await expectRejection(closePa('id1', 'pa1', makeUser({ roles: [] })), 403);
  });

  it('throws 404 when NCR not found', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(null);
    await expectRejection(closePa('id1', 'pa1', qaUser), 404);
  });

  it('throws 404 when the preventive action is not found', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    stubFindById(newNcr({ preventive_actions: [] }));
    const missingId = new mongoose.Types.ObjectId().toString();
    await expectRejection(closePa('id1', missingId, qaUser), 404);
  });

  it('marks the preventive action Completed and appends a pa.closed event', async () => {
    stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA', email: 'qa@test.com' }] });
    const ncr = newNcr({ preventive_actions: [{ action_description: 'x', status: 'In Progress' }] });
    stubFindById(ncr);
    const paId = ncr.preventive_actions[0]._id.toString();

    const result = await closePa('id1', paId, qaUser);

    const pa = result.preventive_actions.id(paId);
    pa.status.should.equal('Completed');
    pa.actual_completion_date.should.be.instanceOf(Date);
    result.events.some(e => e.event_type === 'pa.closed').should.be.true;
  });
});
