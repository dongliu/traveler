const express = require('express');
const auth = require('../lib/auth');
const reqUtils = require('../lib/req-utils');
const { listEntries } = require('../lib/wbs-notification-service');
const logger = require('../lib/loggers').getLogger();

const router = express.Router();

router.get('/', auth.ensureAuthenticated, reqUtils.requireAdmin(), (req, res) => {
  try {
    const entries = listEntries();
    return res.status(200).json({ success: true, entries });
  } catch (err) {
    logger.error('WBS notification list failed:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
