const { Ncr } = require('../model/ncr');
const {
  sendInitialNotification,
  sendDispositionRequest,
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

module.exports = { createNcr };
