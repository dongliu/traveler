const { sendNotification } = require('./email');
const logger = require('./loggers').getLogger();

function buildResult(email, success, error) {
  return {
    recipient_email:    email,
    delivery_status:    success ? 'Delivered' : 'Failed',
    delivery_timestamp: success ? new Date() : null,
    error_message:      success ? null : (error && error.message) || 'Unknown error',
  };
}

// recipients: string | string[]  (email addresses, matching nodemailer's `to` field)
// cc: string | undefined  (optional CC address, same on every outbound message)
async function sendToRecipients(subject, html, recipients, cc) {
  const emails = (Array.isArray(recipients) ? recipients : [recipients]).filter(Boolean);
  const results = [];
  for (const email of emails) {
    try {
      const ok = await sendNotification({ subject, html, recipients: email, cc: cc || undefined });
      results.push(buildResult(email, ok !== false));
    } catch (err) {
      logger.error(`NCR email failed for ${email}:`, err);
      results.push(buildResult(email, false, err));
    }
  }
  return results;
}

// originatorEmail: string | undefined — CC'd so the originator receives a copy of the QA notification
async function sendInitialNotification(ncr, recipients, ncrUrl, originatorEmail) {
  const subject = `NCR ${ncr.ncr_number} Initiated — ${ncr.part_name}`;
  const linkHtml = ncrUrl
    ? `<p>You can get current, as well as, on-going details by following the link below:<br><a href="${ncrUrl}">View NCR ${ncr.ncr_number}</a></p>`
    : '';
  const html = `
    <p>Nonconformance Report No. ${ncr.ncr_number}, concerning the ${ncr.part_name} manufactured by
    ${ncr.supplier_name}, has been initiated by ${ncr.originator_name} and forwarded to
    ${ncr.ce_cs_name} for engineering disposition.</p>
    <p>The initial description of the problem is: ${ncr.description_of_nonconformance}</p>
    ${linkHtml}
  `;
  const results = await sendToRecipients(subject, html, recipients, originatorEmail);
  return { results, cc: originatorEmail ? [originatorEmail] : [] };
}

// originatorEmail: string | undefined — CC'd on the outbound message so the originator gets a copy
async function sendDispositionRequest(ncr, cescs, ncrUrl, originatorEmail) {
  const subject = `Action Required — Engineering Disposition for NCR ${ncr.ncr_number}`;
  const greeting = ncr.ce_cs_name ? `<p>${ncr.ce_cs_name}:</p>` : '';
  const linkHtml = ncrUrl
    ? `<a href="${ncrUrl}">View NCR ${ncr.ncr_number} and submit disposition</a>`
    : 'Please log in to submit your engineering disposition.';
  const html = `
    ${greeting}
    <p>Nonconformance Report No. ${ncr.ncr_number}, concerning the ${ncr.part_name} manufactured by
    ${ncr.supplier_name}, has been initiated by ${ncr.originator_name}. Please complete the CE/CS
    section of the report. You can do so by following the link below:</p>
    <p>${linkHtml}</p>
  `;
  const results = await sendToRecipients(subject, html, cescs, originatorEmail);
  return { results, cc: originatorEmail ? [originatorEmail] : [] };
}

async function sendQaNotification(ncr, qaStaff, context) {
  let subject;
  let body;
  if (context === 'returned_for_comment') {
    subject = `NCR ${ncr.ncr_number} Returned for Comment — QA Action Required`;
    body = `<p>An approver has returned NCR ${ncr.ncr_number} for comment. Please review the comments and resubmit to approvers if appropriate.</p>`;
  } else {
    subject = `NCR ${ncr.ncr_number} Ready for QA Concurrence`;
    body = `<p>Engineering disposition has been submitted for NCR ${ncr.ncr_number}.</p>`;
  }
  const html = `
    ${body}
    <ul>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Disposition</strong>: ${ncr.disposition && ncr.disposition.parts_disposition}</li>
    </ul>
    <p>Please log in to review.</p>
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
  return sendToRecipients(subject, html, originators);
}

async function sendFinalDistribution(ncr, recipients) {
  const subject = `NCR ${ncr.ncr_number} — Closed`;
  const html = `
    <p>NCR ${ncr.ncr_number} has been closed.</p>
    <ul>
      <li><strong>Part</strong>: ${ncr.part_name} (${ncr.part_number})</li>
      <li><strong>Disposition</strong>: ${ncr.disposition && ncr.disposition.parts_disposition}</li>
      <li><strong>Closure Date</strong>: ${ncr.closure_record && ncr.closure_record.closure_date}</li>
    </ul>
  `;
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
