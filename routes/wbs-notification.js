const express = require('express');
const auth = require('../lib/auth');
const reqUtils = require('../lib/req-utils');
const { listEntries, addEntry, updateEntry, removeEntry } = require('../lib/wbs-notification-service');
const logger = require('../lib/loggers').getLogger();

const router = express.Router();

function mapServiceError(err, res, action) {
  if (err.status === 400) return res.status(400).json({ success: false, error: 'Validation Error', message: err.message });
  if (err.status === 404) return res.status(404).json({ success: false, error: 'Not Found', message: err.message });
  if (err.status === 409) return res.status(409).json({ success: false, error: 'Conflict', message: err.message });
  logger.error(`${action} failed:`, err);
  return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
}

function sessionUser(req, res) {
  return { id: req.session.userid, name: res.locals.username };
}

router.get('/', auth.ensureAuthenticated, reqUtils.requireAdmin(), async (req, res) => {
  try {
    const entries = await listEntries();
    return res.status(200).json({ success: true, entries });
  } catch (err) {
    return mapServiceError(err, res, 'WBS notification list');
  }
});

router.post('/', auth.ensureAuthenticated, reqUtils.requireAdmin(), async (req, res) => {
  try {
    const entry = await addEntry(
      { wbs_number: req.body.wbs_number, notification_email: req.body.notification_email },
      sessionUser(req, res)
    );
    return res.status(201).json({ success: true, entry });
  } catch (err) {
    return mapServiceError(err, res, 'WBS notification add');
  }
});

router.patch('/:wbsNumber', auth.ensureAuthenticated, reqUtils.requireAdmin(), async (req, res) => {
  try {
    const entry = await updateEntry(
      decodeURIComponent(req.params.wbsNumber),
      { notification_email: req.body.notification_email },
      sessionUser(req, res)
    );
    return res.status(200).json({ success: true, entry });
  } catch (err) {
    return mapServiceError(err, res, 'WBS notification update');
  }
});

router.delete('/:wbsNumber', auth.ensureAuthenticated, reqUtils.requireAdmin(), async (req, res) => {
  try {
    await removeEntry(decodeURIComponent(req.params.wbsNumber));
    return res.status(200).json({ success: true });
  } catch (err) {
    return mapServiceError(err, res, 'WBS notification remove');
  }
});

module.exports = router;
