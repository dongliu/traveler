const express = require('express');
const auth = require('../lib/auth');
const { createNcr, submitDisposition } = require('../lib/ncr-service');
const logger = require('../lib/loggers').getLogger();

const router = express.Router();

const DISCOVERY_CONTEXTS = [
  'incoming_inspection',
  'in_house_assembly',
  'in_house_inspection',
];

const notImplemented = (req, res) =>
  res.status(501).json({ error: 'Not implemented' });

router.post('/', auth.ensureAuthenticated, async (req, res) => {
  const errors = {};
  const b = req.body;

  if (!b.part_name || !String(b.part_name).trim())
    errors.part_name = ['Required'];
  if (!b.part_number || !String(b.part_number).trim())
    errors.part_number = ['Required'];
  if (!b.part_revision || !String(b.part_revision).trim())
    errors.part_revision = ['Required'];
  if (!b.quantity || Number(b.quantity) < 1)
    errors.quantity = ['Must be greater than 0'];
  if (!b.supplier_name || !String(b.supplier_name).trim())
    errors.supplier_name = ['Required'];
  if (!b.wbs_number || !String(b.wbs_number).trim())
    errors.wbs_number = ['Required'];
  if (!b.ce_cs_name || !String(b.ce_cs_name).trim())
    errors.ce_cs_name = ['Required'];
  if (!b.specification_drawing_reference || !String(b.specification_drawing_reference).trim())
    errors.specification_drawing_reference = ['Required'];
  if (!b.description_of_nonconformance || String(b.description_of_nonconformance).trim().length < 20)
    errors.description_of_nonconformance = ['Must be at least 20 characters long'];
  if (!b.discovery_date)
    errors.discovery_date = ['Required'];
  else if (new Date(b.discovery_date) > new Date())
    errors.discovery_date = ['Cannot be in the future'];
  if (!b.discovery_context || !DISCOVERY_CONTEXTS.includes(b.discovery_context))
    errors.discovery_context = [`Must be one of: ${DISCOVERY_CONTEXTS.join(', ')}`];

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, error: 'Validation Error', details: errors });
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

router.get('/', auth.ensureAuthenticated, notImplemented);

router.get('/:id', auth.ensureAuthenticated, notImplemented);

router.get('/:id/events', auth.ensureAuthenticated, notImplemented);

router.patch('/:id/disposition', auth.ensureAuthenticated, async (req, res) => {
  const errors = {};
  const b = req.body;
  const PARTS_DISPOSITIONS = ['Rework', 'Repair', 'Return to Vendor', 'Scrap', 'Use-As-Is'];

  if (!b.parts_disposition || !PARTS_DISPOSITIONS.includes(b.parts_disposition))
    errors.parts_disposition = [`Must be one of: ${PARTS_DISPOSITIONS.join(', ')}`];
  if (!b.root_cause_documentation || String(b.root_cause_documentation).trim().length < 50)
    errors.root_cause_documentation = ['Must be at least 50 characters long'];
  if (!Array.isArray(b.preventive_actions) || b.preventive_actions.length < 1)
    errors.preventive_actions = ['Requires at least 1 action'];
  else if (b.preventive_actions.some(a => !a || String(a).trim().length < 50))
    errors.preventive_actions = ['Each action must be at least 50 characters long'];
  if (['Rework', 'Repair'].includes(b.parts_disposition)) {
    if (!b.rework_repair_instructions || String(b.rework_repair_instructions).trim().length < 50)
      errors.rework_repair_instructions = ["Required when parts_disposition is 'Rework' or 'Repair'"];
  }

  if (Object.keys(errors).length > 0)
    return res.status(400).json({ success: false, error: 'Validation Error', details: errors });

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

router.patch('/:id/concurrence', auth.ensureAuthenticated, notImplemented);

router.patch('/:id/approve', auth.ensureAuthenticated, notImplemented);

router.patch('/:id/close', auth.ensureAuthenticated, notImplemented);

router.patch(
  '/:id/preventive-actions/:pa_id/owner',
  auth.ensureAuthenticated,
  notImplemented
);

router.patch(
  '/:id/preventive-actions/:pa_id/status',
  auth.ensureAuthenticated,
  notImplemented
);

module.exports = router;
