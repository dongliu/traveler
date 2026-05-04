const mongoose = require('mongoose');
const { Ncr } = require('../model/ncr');
const { createNcrStateMachine } = require('./ncr-state-machine');
const {
  sendInitialNotification,
  sendDispositionRequest,
  sendQaNotification,
  sendApprovalRequest,
  sendIssuance,
} = require('./ncr-email');

function hasRole(user, role) {
  return Array.isArray(user.roles) && user.roles.includes(role);
}

function appendNotificationEvent(ncr, eventType, results) {
  ncr.events.push({
    event_type: eventType,
    actor_type: 'system',
    timestamp: new Date(),
    recipients: results.map(r => ({
      recipient_id: r.recipient_id,
      recipient_email: r.recipient_email,
      delivery_status: r.delivery_status,
      delivery_timestamp: r.delivery_timestamp,
      error_message: r.error_message,
    })),
  });
}

async function findUsers(ids) {
  if (!ids || ids.length === 0) return [];
  const User = mongoose.model('User');
  return User.find({ _id: { $in: ids } }, { _id: 1, name: 1, email: 1 }).lean();
}

async function findQaStaff() {
  const User = mongoose.model('User');
  return User.find({ roles: 'qa_staff' }, { _id: 1, name: 1, email: 1 }).lean();
}

async function generateNcrNumber() {
  const year = new Date().getFullYear();
  const prefix = `NCR-${year}-`;
  const last = await Ncr.findOne(
    { ncr_number: { $regex: `^${prefix}` } },
    { ncr_number: 1 },
    { sort: { ncr_number: -1 } }
  );
  let seq = 1;
  if (last && last.ncr_number) {
    const parts = last.ncr_number.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createNcr(data, user) {
  const now = new Date();
  const ncrNumber = await generateNcrNumber();

  const ncr = new Ncr({
    ncr_number: ncrNumber,
    originator_id: user.id,
    originator_name: user.name,
    creation_timestamp: now,
    discovery_date: data.discovery_date,
    discovery_context: data.discovery_context,
    part_name: data.part_name,
    part_number: data.part_number,
    part_revision: data.part_revision,
    quantity: data.quantity,
    supplier_name: data.supplier_name,
    wbs_number: data.wbs_number,
    specification_drawing_reference: data.specification_drawing_reference,
    po_reference: data.po_reference,
    description_of_nonconformance: data.description_of_nonconformance,
    ce_cs_name: data.ce_cs_name,
    ce_cs_id: data.ce_cs_id,
    status: 'Submitted',
  });

  if (data.traveler_id) {
    ncr.traveler_link = {
      traveler_id: data.traveler_id,
      step_number: data.traveler_step_number,
      initiated_from_traveler: true,
    };
  }

  ncr.events.push({
    event_type: 'ncr.submitted',
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.name,
    actor_role: 'originator',
    timestamp: now,
    previous_status: null,
    new_status: 'Submitted',
    payload: {
      ncr_number: ncrNumber,
      part_name: data.part_name,
      part_number: data.part_number,
    },
  });

  const originatorRecipient = { recipient_id: user.id, email: user.email };
  const initialResults = await sendInitialNotification(ncr, [originatorRecipient]);
  ncr.events.push({
    event_type: 'notification.initial',
    actor_type: 'system',
    timestamp: new Date(),
    recipients: initialResults.map(r => ({
      recipient_id: r.recipient_id,
      recipient_email: r.recipient_email,
      delivery_status: r.delivery_status,
      delivery_timestamp: r.delivery_timestamp,
      error_message: r.error_message,
    })),
  });

  const cesRecipients = [];
  if (data.ce_cs_id) {
    cesRecipients.push({ recipient_id: data.ce_cs_id, email: data.ce_cs_email });
  }
  if (cesRecipients.length > 0) {
    const dispResults = await sendDispositionRequest(ncr, cesRecipients);
    ncr.events.push({
      event_type: 'notification.disposition_request',
      actor_type: 'system',
      timestamp: new Date(),
      recipients: dispResults.map(r => ({
        recipient_id: r.recipient_id,
        recipient_email: r.recipient_email,
        delivery_status: r.delivery_status,
        delivery_timestamp: r.delivery_timestamp,
        error_message: r.error_message,
      })),
    });
  }

  await ncr.save();
  return ncr;
}

async function submitDisposition(ncrId, data, user) {
  const User = mongoose.model('User');
  const ncr = await Ncr.findById(ncrId);
  if (!ncr) {
    const err = new Error(`NCR not found: ${ncrId}`);
    err.status = 404;
    throw err;
  }

  if (ncr.ce_cs_id !== user.id && ncr.ce_cs_delegate_id !== user.id) {
    const err = new Error('Only assigned CE/CS or Originator Delegate can submit disposition for this NCR');
    err.status = 403;
    throw err;
  }

  const fsm = createNcrStateMachine(ncr.status);
  if (!fsm.can('submitDisposition')) {
    const err = new Error(`NCR must be in 'Submitted' status to submit disposition. Current status: ${ncr.status}`);
    err.status = 409;
    throw err;
  }

  const now = new Date();
  const previousStatus = ncr.status;

  ncr.disposition = {
    parts_disposition: data.parts_disposition,
    root_cause_documentation: data.root_cause_documentation,
    ce_cs_identity: user.id,
    ce_cs_timestamp: now,
  };
  if (['Rework', 'Repair'].includes(data.parts_disposition)) {
    ncr.disposition.rework_repair_instructions = data.rework_repair_instructions;
  }

  ncr.preventive_actions = data.preventive_actions.map(desc => ({
    action_description: desc,
    status: 'Open',
    created_at: now,
    updated_at: now,
  }));

  fsm.submitDisposition();
  ncr.status = fsm.state;

  ncr.events.push({
    event_type: 'disposition.submitted',
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.name,
    actor_role: 'ce_cs',
    timestamp: now,
    previous_status: previousStatus,
    new_status: ncr.status,
    payload: {
      parts_disposition: data.parts_disposition,
      root_cause_excerpt: data.root_cause_documentation.slice(0, 100),
      preventive_action_count: data.preventive_actions.length,
    },
  });

  const qaUsers = await User.find({ roles: 'qa_staff' }, { _id: 1, name: 1, email: 1 }).lean();
  const qaRecipients = qaUsers.map(u => ({ recipient_id: u._id, email: u.email }));
  if (qaRecipients.length > 0) {
    const qaResults = await sendQaNotification(ncr, qaRecipients);
    ncr.events.push({
      event_type: 'notification.qa_notification',
      actor_type: 'system',
      timestamp: new Date(),
      recipients: qaResults.map(r => ({
        recipient_id: r.recipient_id,
        recipient_email: r.recipient_email,
        delivery_status: r.delivery_status,
        delivery_timestamp: r.delivery_timestamp,
        error_message: r.error_message,
      })),
    });
  }

  await ncr.save();
  return ncr;
}

async function submitConcurrence(ncrId, additionalApprovers, user) {
  if (!hasRole(user, 'qa_staff')) {
    const err = new Error('Only QA Staff can provide concurrence');
    err.status = 403;
    throw err;
  }

  const ncr = await Ncr.findById(ncrId);
  if (!ncr) {
    const err = new Error(`NCR not found: ${ncrId}`);
    err.status = 404;
    throw err;
  }
  if (ncr.status !== 'Dispositioned') {
    const err = new Error(`NCR must be in 'Dispositioned' status. Current status: ${ncr.status}`);
    err.status = 409;
    throw err;
  }

  const fsm = createNcrStateMachine(ncr.status);
  const now = new Date();
  const previousStatus = ncr.status;

  ncr.qa_staff_identity = user.id;
  ncr.qa_staff_name = user.name;
  ncr.qa_concurrence_timestamp = now;

  const approvers = Array.isArray(additionalApprovers) ? additionalApprovers : [];

  if (approvers.length === 0) {
    fsm.concurNoApprovers();
    ncr.status = fsm.state;

    ncr.events.push({
      event_type: 'qa.concurred',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.name,
      actor_role: 'qa_staff',
      timestamp: now,
      previous_status: previousStatus,
      new_status: ncr.status,
      payload: { additional_approvers: [] },
    });

    const originatorRecipient = { recipient_id: ncr.originator_id, email: user.email };
    const issuanceUsers = await findUsers([ncr.originator_id]);
    const recipients = issuanceUsers.length > 0
      ? issuanceUsers.map(u => ({ recipient_id: u._id, email: u.email }))
      : [originatorRecipient];
    const results = await sendIssuance(ncr, recipients);
    appendNotificationEvent(ncr, 'notification.issuance', results);
  } else {
    const approverIds = approvers.map(a => a.approver_id);
    const approverUsers = await findUsers(approverIds);
    const userById = {};
    approverUsers.forEach(u => { userById[u._id] = u; });

    ncr.additional_approvers = approvers.map(a => {
      const u = userById[a.approver_id] || {};
      return {
        approver_id: a.approver_id,
        approver_name: u.name || a.approver_id,
        approver_role: a.approver_role,
        designated_timestamp: now,
        approval_status: 'Pending',
      };
    });

    fsm.concurWithApprovers();
    ncr.status = fsm.state;

    ncr.events.push({
      event_type: 'qa.concurred',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.name,
      actor_role: 'qa_staff',
      timestamp: now,
      previous_status: previousStatus,
      new_status: ncr.status,
      payload: {
        additional_approvers: ncr.additional_approvers.map(a => ({
          approver_id: a.approver_id,
          approver_role: a.approver_role,
        })),
      },
    });

    ncr.events.push({
      event_type: 'approvers.designated',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.name,
      actor_role: 'qa_staff',
      timestamp: now,
      payload: {
        approver_count: ncr.additional_approvers.length,
      },
    });

    const recipients = approverUsers.map(u => ({ recipient_id: u._id, email: u.email }));
    const results = await sendApprovalRequest(ncr, recipients);
    appendNotificationEvent(ncr, 'notification.approval_request', results);
  }

  await ncr.save();
  return ncr;
}

async function submitApproval(ncrId, user) {
  const ncr = await Ncr.findById(ncrId);
  if (!ncr) {
    const err = new Error(`NCR not found: ${ncrId}`);
    err.status = 404;
    throw err;
  }
  if (ncr.status !== 'Approved') {
    const err = new Error(`NCR must be in 'Approved' status. Current status: ${ncr.status}`);
    err.status = 409;
    throw err;
  }

  const approverEntry = ncr.additional_approvers.find(a => a.approver_id === user.id);
  if (!approverEntry) {
    const err = new Error('User is not a designated approver for this NCR');
    err.status = 403;
    throw err;
  }
  if (approverEntry.approval_status === 'Approved') {
    const err = new Error('You have already approved this NCR');
    err.status = 409;
    throw err;
  }

  const now = new Date();
  approverEntry.approval_status = 'Approved';
  approverEntry.approval_timestamp = now;

  ncr.events.push({
    event_type: 'approval.approved',
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.name,
    actor_role: approverEntry.approver_role,
    timestamp: now,
    previous_status: ncr.status,
    new_status: ncr.status,
    payload: { approver_id: user.id, approver_role: approverEntry.approver_role },
  });

  const allApproved = ncr.additional_approvers.every(a => a.approval_status === 'Approved');
  if (allApproved) {
    const fsm = createNcrStateMachine(ncr.status);
    fsm.finalApprove();
    ncr.status = fsm.state;
    ncr.events[ncr.events.length - 1].new_status = ncr.status;

    const issuanceUsers = await findUsers([ncr.originator_id]);
    const recipients = issuanceUsers.map(u => ({ recipient_id: u._id, email: u.email }));
    if (recipients.length > 0) {
      const results = await sendIssuance(ncr, recipients);
      appendNotificationEvent(ncr, 'notification.issuance', results);
    }
  }

  await ncr.save();
  return ncr;
}

async function returnForComment(ncrId, comments, user) {
  if (!comments || String(comments).trim().length === 0) {
    const err = new Error('Comments are required when returning for comment');
    err.status = 400;
    throw err;
  }

  const ncr = await Ncr.findById(ncrId);
  if (!ncr) {
    const err = new Error(`NCR not found: ${ncrId}`);
    err.status = 404;
    throw err;
  }
  if (ncr.status !== 'Approved') {
    const err = new Error(`NCR must be in 'Approved' status. Current status: ${ncr.status}`);
    err.status = 409;
    throw err;
  }

  const approverEntry = ncr.additional_approvers.find(a => a.approver_id === user.id);
  if (!approverEntry) {
    const err = new Error('User is not a designated approver for this NCR');
    err.status = 403;
    throw err;
  }

  const fsm = createNcrStateMachine(ncr.status);
  const now = new Date();
  const previousStatus = ncr.status;

  approverEntry.approval_status = 'Returned for Comment';
  approverEntry.approval_timestamp = now;
  approverEntry.comments = comments;

  fsm.returnForComment();
  ncr.status = fsm.state;

  ncr.events.push({
    event_type: 'approval.returned_for_comment',
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.name,
    actor_role: approverEntry.approver_role,
    timestamp: now,
    previous_status: previousStatus,
    new_status: ncr.status,
    payload: {
      approver_id: user.id,
      approver_role: approverEntry.approver_role,
      comments,
    },
  });

  const qaUsers = await findQaStaff();
  if (qaUsers.length > 0) {
    const recipients = qaUsers.map(u => ({ recipient_id: u._id, email: u.email }));
    const results = await sendQaNotification(ncr, recipients, 'returned_for_comment');
    appendNotificationEvent(ncr, 'notification.qa_notification', results);
  }

  await ncr.save();
  return ncr;
}

async function qaResubmit(ncrId, user) {
  if (!hasRole(user, 'qa_staff')) {
    const err = new Error('Only QA Staff can resubmit to approvers');
    err.status = 403;
    throw err;
  }

  const ncr = await Ncr.findById(ncrId);
  if (!ncr) {
    const err = new Error(`NCR not found: ${ncrId}`);
    err.status = 404;
    throw err;
  }
  if (ncr.status !== 'Returned for Comment') {
    const err = new Error(`NCR must be in 'Returned for Comment' status. Current status: ${ncr.status}`);
    err.status = 409;
    throw err;
  }

  const fsm = createNcrStateMachine(ncr.status);
  const now = new Date();
  const previousStatus = ncr.status;

  ncr.additional_approvers.forEach(a => {
    if (a.approval_status === 'Returned for Comment') {
      a.approval_status = 'Pending';
      a.approval_timestamp = undefined;
    }
  });

  fsm.resubmitToApprovers();
  ncr.status = fsm.state;

  ncr.events.push({
    event_type: 'qa.resubmitted',
    actor_type: 'user',
    actor_id: user.id,
    actor_name: user.name,
    actor_role: 'qa_staff',
    timestamp: now,
    previous_status: previousStatus,
    new_status: ncr.status,
  });

  const approverIds = ncr.additional_approvers
    .filter(a => a.approval_status === 'Pending')
    .map(a => a.approver_id);
  const approverUsers = await findUsers(approverIds);
  if (approverUsers.length > 0) {
    const recipients = approverUsers.map(u => ({ recipient_id: u._id, email: u.email }));
    const results = await sendApprovalRequest(ncr, recipients);
    appendNotificationEvent(ncr, 'notification.approval_request', results);
  }

  await ncr.save();
  return ncr;
}

module.exports = {
  createNcr,
  submitDisposition,
  submitConcurrence,
  submitApproval,
  returnForComment,
  qaResubmit,
};
