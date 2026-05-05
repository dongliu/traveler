const express = require('express');
const mongoose = require('mongoose');
const auth = require('../lib/auth');
const {
  createNcr,
  submitDisposition,
  submitConcurrence,
  submitApproval,
  returnForComment,
  qaResubmit,
  closeNcr,
  listNcrs,
  getNcrById,
  assignPaOwner,
  updatePaStatus,
  closePa,
} = require('../lib/ncr-service');
const logger = require('../lib/loggers').getLogger();

const router = express.Router();

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

function sanitizeStr(val) {
  if (val === undefined || val === null) return val;
  return String(val).replace(/<[^>]*>/g, '').trim();
}

function badId(res, param) {
  return res.status(400).json({ success: false, error: 'Bad Request', message: `Invalid ${param} format` });
}

const DISCOVERY_CONTEXTS = [
  'incoming_inspection',
  'in_house_assembly',
  'in_house_inspection',
];

router.post('/', auth.ensureAuthenticated, async (req, res) => {
  const errors = {};
  const b = {
    part_name: sanitizeStr(req.body.part_name),
    part_number: sanitizeStr(req.body.part_number),
    part_revision: sanitizeStr(req.body.part_revision),
    quantity: req.body.quantity,
    supplier_name: sanitizeStr(req.body.supplier_name),
    wbs_number: sanitizeStr(req.body.wbs_number),
    ce_cs_name: sanitizeStr(req.body.ce_cs_name),
    ce_cs_id: sanitizeStr(req.body.ce_cs_id),
    ce_cs_email: sanitizeStr(req.body.ce_cs_email),
    specification_drawing_reference: sanitizeStr(req.body.specification_drawing_reference),
    po_reference: sanitizeStr(req.body.po_reference),
    description_of_nonconformance: sanitizeStr(req.body.description_of_nonconformance),
    discovery_date: req.body.discovery_date,
    discovery_context: req.body.discovery_context,
    traveler_id: req.body.traveler_id,
    traveler_step_number: req.body.traveler_step_number,
  };

  if (!b.part_name) errors.part_name = ['Required'];
  if (!b.part_number) errors.part_number = ['Required'];
  if (!b.part_revision) errors.part_revision = ['Required'];
  if (!b.quantity || Number(b.quantity) < 1)
    errors.quantity = ['Must be greater than 0'];
  if (!b.supplier_name) errors.supplier_name = ['Required'];
  if (!b.wbs_number) errors.wbs_number = ['Required'];
  if (!b.ce_cs_name) errors.ce_cs_name = ['Required'];
  if (!b.specification_drawing_reference)
    errors.specification_drawing_reference = ['Required'];
  if (!b.description_of_nonconformance || b.description_of_nonconformance.length < 20)
    errors.description_of_nonconformance = ['Must be at least 20 characters long'];
  if (!b.discovery_date)
    errors.discovery_date = ['Required'];
  else if (new Date(b.discovery_date) > new Date())
    errors.discovery_date = ['Cannot be in the future'];
  if (!b.discovery_context || !DISCOVERY_CONTEXTS.includes(b.discovery_context))
    errors.discovery_context = [`Must be one of: ${DISCOVERY_CONTEXTS.join(', ')}`];

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, error: 'Validation Error', message: 'Validation failed', details: errors });
  }

  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      email: res.locals.userEmail || '',
    };
    const ncr = await createNcr(b, user);
    return res.status(201).json({
      success: true,
      ncr: {
        ncr_number: ncr.ncr_number,
        ncr_id: ncr._id,
        status: ncr.status,
        creation_timestamp: ncr.creation_timestamp,
        originator_id: ncr.originator_id,
        part_name: ncr.part_name,
        part_number: ncr.part_number,
      },
      message: 'NCR created successfully. Initial notification emails sent.',
    });
  } catch (err) {
    logger.error('NCR creation failed:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

router.get('/', auth.ensureAuthenticated, async (req, res) => {
  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const filters = {
      status: req.query.status,
      part_number: req.query.part_number,
      supplier_name: req.query.supplier_name,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      parts_disposition: req.query.parts_disposition,
      root_cause: req.query.root_cause,
      includeClosed: req.query.includeClosed === 'true' || req.query.includeClosed === true,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await listNcrs(filters, user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('NCR list failed:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

router.get('/:id', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = await getNcrById(req.params.id, user);
    return res.status(200).json({ success: true, ncr });
  } catch (err) {
    return mapServiceError(err, res, 'NCR fetch');
  }
});

router.get('/:id/events', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = await getNcrById(req.params.id, user);
    const events = (ncr.events || [])
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return res.status(200).json({ success: true, ncr_id: ncr._id, events });
  } catch (err) {
    return mapServiceError(err, res, 'Events fetch');
  }
});

router.patch('/:id/disposition', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  const errors = {};
  const PARTS_DISPOSITIONS = ['Rework', 'Repair', 'Return to Vendor', 'Scrap', 'Use-As-Is'];
  const b = {
    parts_disposition: req.body.parts_disposition,
    root_cause_documentation: sanitizeStr(req.body.root_cause_documentation),
    rework_repair_instructions: sanitizeStr(req.body.rework_repair_instructions),
    preventive_actions: Array.isArray(req.body.preventive_actions)
      ? req.body.preventive_actions.map(a => sanitizeStr(a))
      : req.body.preventive_actions,
  };

  if (!b.parts_disposition || !PARTS_DISPOSITIONS.includes(b.parts_disposition))
    errors.parts_disposition = [`Must be one of: ${PARTS_DISPOSITIONS.join(', ')}`];
  if (!b.root_cause_documentation || b.root_cause_documentation.length < 50)
    errors.root_cause_documentation = ['Must be at least 50 characters long'];
  if (!Array.isArray(b.preventive_actions) || b.preventive_actions.length < 1)
    errors.preventive_actions = ['Requires at least 1 action'];
  else if (b.preventive_actions.some(a => !a || String(a).trim().length < 50))
    errors.preventive_actions = ['Each action must be at least 50 characters long'];
  if (['Rework', 'Repair'].includes(b.parts_disposition)) {
    if (!b.rework_repair_instructions || b.rework_repair_instructions.length < 50)
      errors.rework_repair_instructions = ["Required when parts_disposition is 'Rework' or 'Repair'"];
  }

  if (Object.keys(errors).length > 0)
    return res.status(400).json({ success: false, error: 'Validation Error', message: 'Validation failed', details: errors });

  try {
    const user = { id: req.session.userid, name: res.locals.username };
    const ncr = await submitDisposition(req.params.id, b, user);
    return res.status(200).json({
      success: true,
      ncr: {
        ncr_id: ncr._id,
        ncr_number: ncr.ncr_number,
        status: ncr.status,
        disposition: ncr.disposition,
        previous_status: 'Submitted',
      },
      message: 'Disposition submitted successfully. QA Staff notified for concurrence review.',
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ success: false, error: 'Not Found', message: err.message });
    if (err.status === 403) return res.status(403).json({ success: false, error: 'Forbidden', message: err.message });
    if (err.status === 409) return res.status(409).json({ success: false, error: 'Conflict', message: err.message });
    logger.error('Disposition submission failed:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

function mapServiceError(err, res, action) {
  if (err.status === 400) return res.status(400).json({ success: false, error: 'Validation Error', message: err.message });
  if (err.status === 403) return res.status(403).json({ success: false, error: 'Forbidden', message: err.message });
  if (err.status === 404) return res.status(404).json({ success: false, error: 'Not Found', message: err.message });
  if (err.status === 409) return res.status(409).json({ success: false, error: 'Conflict', message: err.message });
  logger.error(`${action} failed:`, err);
  return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
}

router.patch('/:id/concurrence', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  const additionalApprovers = req.body.additional_approvers;
  if (additionalApprovers !== undefined && !Array.isArray(additionalApprovers)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Validation failed',
      details: { additional_approvers: ['Must be an array'] },
    });
  }
  if (Array.isArray(additionalApprovers)) {
    for (const a of additionalApprovers) {
      if (!a || !a.approver_id || !a.approver_role) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Validation failed',
          details: { additional_approvers: ['Each entry requires approver_id and approver_role'] },
        });
      }
    }
  }

  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      email: res.locals.userEmail || '',
      roles: res.locals.roles || [],
    };
    const ncr = await submitConcurrence(req.params.id, additionalApprovers || [], user);
    return res.status(200).json({
      success: true,
      ncr: {
        ncr_id: ncr._id,
        ncr_number: ncr.ncr_number,
        status: ncr.status,
        additional_approvers: ncr.additional_approvers,
      },
    });
  } catch (err) {
    return mapServiceError(err, res, 'Concurrence');
  }
});

router.patch('/:id/approve', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  const action = req.body.action;
  const comments = sanitizeStr(req.body.comments);
  if (!['approve', 'return_for_comment'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Validation failed',
      details: { action: ["Must be 'approve' or 'return_for_comment'"] },
    });
  }
  if (action === 'return_for_comment' && (!comments || comments.length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Validation failed',
      details: { comments: ['Required when action is return_for_comment'] },
    });
  }

  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = action === 'approve'
      ? await submitApproval(req.params.id, user)
      : await returnForComment(req.params.id, comments, user);
    return res.status(200).json({
      success: true,
      ncr: {
        ncr_id: ncr._id,
        ncr_number: ncr.ncr_number,
        status: ncr.status,
        additional_approvers: ncr.additional_approvers,
      },
    });
  } catch (err) {
    return mapServiceError(err, res, 'Approval');
  }
});

router.patch('/:id/resubmit', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = await qaResubmit(req.params.id, user);
    return res.status(200).json({
      success: true,
      ncr: {
        ncr_id: ncr._id,
        ncr_number: ncr.ncr_number,
        status: ncr.status,
        additional_approvers: ncr.additional_approvers,
      },
    });
  } catch (err) {
    return mapServiceError(err, res, 'QA resubmit');
  }
});

router.patch('/:id/close', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  const errors = {};
  const b = {
    closure_notes: sanitizeStr(req.body.closure_notes),
    disposition_execution_verified: req.body.disposition_execution_verified,
    preventive_actions_verified: req.body.preventive_actions_verified,
    traveler_signed_off: req.body.traveler_signed_off,
  };
  if (!b.closure_notes || b.closure_notes.length < 20)
    errors.closure_notes = ['Required and must be at least 20 characters'];

  if (Object.keys(errors).length > 0)
    return res.status(400).json({ success: false, error: 'Validation Error', message: 'Validation failed', details: errors });

  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = await closeNcr(req.params.id, b, user);
    return res.status(200).json({
      success: true,
      ncr: {
        ncr_id: ncr._id,
        ncr_number: ncr.ncr_number,
        status: ncr.status,
        closure_record: ncr.closure_record,
      },
      message: 'NCR closed successfully. Final distribution sent to all stakeholders.',
    });
  } catch (err) {
    return mapServiceError(err, res, 'Closure');
  }
});

router.patch('/:id/preventive-actions/:pa_id/owner', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  if (!isValidId(req.params.pa_id)) return badId(res, 'pa_id');
  const b = {
    owner_id: sanitizeStr(req.body.owner_id),
    owner_name: sanitizeStr(req.body.owner_name),
    owner_email: sanitizeStr(req.body.owner_email),
    target_completion_date: req.body.target_completion_date,
  };
  const errors = {};
  if (!b.owner_id) errors.owner_id = ['Required'];
  if (!b.owner_name) errors.owner_name = ['Required'];
  if (!b.owner_email) errors.owner_email = ['Required'];
  if (!b.target_completion_date) errors.target_completion_date = ['Required'];
  if (Object.keys(errors).length > 0)
    return res.status(400).json({ success: false, error: 'Validation Error', message: 'Validation failed', details: errors });

  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = await assignPaOwner(req.params.id, req.params.pa_id, b, user);
    const pa = ncr.preventive_actions.id(req.params.pa_id);
    return res.status(200).json({ success: true, ncr_id: ncr._id, preventive_action: pa });
  } catch (err) {
    return mapServiceError(err, res, 'PA owner assign');
  }
});

router.patch('/:id/preventive-actions/:pa_id/status', auth.ensureAuthenticated, async (req, res) => {
  if (!isValidId(req.params.id)) return badId(res, 'id');
  if (!isValidId(req.params.pa_id)) return badId(res, 'pa_id');
  const action = req.body.action;
  const comment = sanitizeStr(req.body.comment);
  if (!['update', 'close'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Validation failed',
      details: { action: ["Must be 'update' or 'close'"] },
    });
  }
  if (action === 'update' && !req.body.status) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Validation failed',
      details: { status: ['Required when action is update'] },
    });
  }

  try {
    const user = {
      id: req.session.userid,
      name: res.locals.username,
      roles: res.locals.roles || [],
    };
    const ncr = action === 'close'
      ? await closePa(req.params.id, req.params.pa_id, user)
      : await updatePaStatus(req.params.id, req.params.pa_id, { status: req.body.status, comment }, user);
    const pa = ncr.preventive_actions.id(req.params.pa_id);
    return res.status(200).json({ success: true, ncr_id: ncr._id, preventive_action: pa });
  } catch (err) {
    return mapServiceError(err, res, 'PA status update');
  }
});

module.exports = router;
