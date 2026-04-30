const express = require('express');
const auth = require('../lib/auth');

const router = express.Router();

const notImplemented = (req, res) =>
  res.status(501).json({ error: 'Not implemented' });

router.post(
  '/',
  auth.ensureAuthenticated,
  notImplemented
);

router.get(
  '/',
  auth.ensureAuthenticated,
  notImplemented
);

router.get(
  '/:id',
  auth.ensureAuthenticated,
  notImplemented
);

router.get(
  '/:id/events',
  auth.ensureAuthenticated,
  notImplemented
);

router.patch(
  '/:id/disposition',
  auth.ensureAuthenticated,
  notImplemented
);

router.patch(
  '/:id/concurrence',
  auth.ensureAuthenticated,
  notImplemented
);

router.patch(
  '/:id/approve',
  auth.ensureAuthenticated,
  notImplemented
);

router.patch(
  '/:id/close',
  auth.ensureAuthenticated,
  notImplemented
);

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
