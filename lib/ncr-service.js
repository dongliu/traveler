const mongoose = require('mongoose');
const { Ncr } = require('../model/ncr');
const { createNcrStateMachine } = require('./ncr-state-machine');
const {
  sendInitialNotification,
  sendDispositionRequest,
  sendQaNotification,
} = require('./ncr-email');

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

module.exports = { createNcr, submitDisposition };
