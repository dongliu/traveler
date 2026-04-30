const { sendNotification } = require('./email');
const logger = require('./loggers').getLogger();

function buildResult(recipient, success, error) {
  return {
    recipient_id:       recipient.recipient_id || recipient._id || null,
    recipient_email:    recipient.email || recipient.recipient_email,
    delivery_status:    success ? 'Delivered' : 'Failed',
    delivery_timestamp: success ? new Date() : null,
    error_message:      success ? null : (error && error.message) || 'Unknown error',
  };
}

async function sendToRecipients(subject, html, recipients) {
  const results = [];
  for (const recipient of recipients) {
    const email = recipient.email || recipient.recipient_email;
    try {
      const ok = await sendNotification({ subject, html, recipients: email });
      results.push(buildResult(recipient, ok !== false));
    } catch (err) {
      logger.error(`NCR email failed for ${email}:`, err);
      results.push(buildResult(recipient, false, err));
    }
  }
  return results;
}

async function sendInitialNotification(ncr, recipients) {
  const subject = `NCR ${ncr.ncr_number} Submitted — ${ncr.part_name}`;
  const html = `
    <p>A new Nonconformance Report has been submitted.</p>
    <ul>
      <li><strong>NCR Number</strong>: ${ncr.ncr_number}</li>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Supplier</strong>: ${ncr.supplier_name}</li>
      <li><strong>WBS</strong>: ${ncr.wbs_number}</li>
      <li><strong>Status</strong>: Submitted</li>
    </ul>
  `;
  return sendToRecipients(subject, html, recipients);
}

async function sendDispositionRequest(ncr, cescs) {
  const subject = `Action Required — Engineering Disposition for NCR ${ncr.ncr_number}`;
  const html = `
    <p>An engineering disposition is required for the following NCR.</p>
    <ul>
      <li><strong>NCR Number</strong>: ${ncr.ncr_number}</li>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Nonconformance</strong>: ${ncr.description_of_nonconformance}</li>
    </ul>
    <p>Please log in to submit your engineering disposition.</p>
  `;
  return sendToRecipients(subject, html, cescs);
}

async function sendQaNotification(ncr, qaStaff) {
  const subject = `NCR ${ncr.ncr_number} Ready for QA Concurrence`;
  const html = `
    <p>Engineering disposition has been submitted for NCR ${ncr.ncr_number}.</p>
    <ul>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Disposition</strong>: ${ncr.disposition && ncr.disposition.parts_disposition}</li>
    </ul>
    <p>Please log in to review and provide QA concurrence.</p>
  `;
  return sendToRecipients(subject, html, qaStaff);
}

async function sendApprovalRequest(ncr, approvers) {
  const subject = `Action Required — Approval Needed for NCR ${ncr.ncr_number}`;
  const html = `
    <p>Your approval is required for NCR ${ncr.ncr_number}.</p>
    <ul>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Disposition</strong>: ${ncr.disposition && ncr.disposition.parts_disposition}</li>
    </ul>
    <p>Please log in to approve or return for comment.</p>
  `;
  return sendToRecipients(subject, html, approvers);
}

async function sendIssuance(ncr, originators) {
  const subject = `NCR ${ncr.ncr_number} — Final Approval Reached`;
  const html = `
    <p>NCR ${ncr.ncr_number} has received all required approvals.</p>
    <ul>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Disposition</strong>: ${ncr.disposition && ncr.disposition.parts_disposition}</li>
    </ul>
    <p>Please log in to execute the disposition and close the NCR.</p>
  `;
  const recipients = Array.isArray(originators) ? originators : [originators];
  return sendToRecipients(subject, html, recipients);
}

async function sendFinalDistribution(ncr, allRecipientGroups) {
  const subject = `NCR ${ncr.ncr_number} — Closed`;
  const html = `
    <p>NCR ${ncr.ncr_number} has been closed.</p>
    <ul>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Disposition</strong>: ${ncr.disposition && ncr.disposition.parts_disposition}</li>
      <li><strong>Closure Date</strong>: ${ncr.closure_record && ncr.closure_record.closure_date}</li>
    </ul>
  `;
  const recipients = allRecipientGroups.flat();
  return sendToRecipients(subject, html, recipients);
}

async function sendPaAssigned(ncr, pa, owner) {
  const subject = `Preventive Action Assigned — NCR ${ncr.ncr_number}`;
  const html = `
    <p>You have been assigned a preventive action for NCR ${ncr.ncr_number}.</p>
    <ul>
      <li><strong>Action</strong>: ${pa.action_description}</li>
      <li><strong>Target Date</strong>: ${pa.target_completion_date}</li>
    </ul>
    <p>Please log in to update the status of your preventive action.</p>
  `;
  return sendToRecipients(subject, html, [owner]);
}

module.exports = {
  sendInitialNotification,
  sendDispositionRequest,
  sendQaNotification,
  sendApprovalRequest,
  sendIssuance,
  sendFinalDistribution,
  sendPaAssigned,
};
