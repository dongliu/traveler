const auth = require('../lib/auth');
const { Ncr } = require('../model/ncr');
const { isQaStaffMember } = require('../lib/ncr-service');
const routesUtilities = require('../utilities/routes');
const logger = require('../lib/loggers').getLogger();

module.exports = function(app) {
  app.get('/ncrs', auth.ensureAuthenticated, function(req, res) {
    res.render('ncr-dashboard', routesUtilities.getRenderObject(req));
  });

  app.get('/ncrs/new', auth.ensureAuthenticated, function(req, res) {
    res.render('ncr-create', routesUtilities.getRenderObject(req));
  });

  app.get('/ncrs/:id/concurrence', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      if (ncr.status !== 'Dispositioned') return res.redirect(`${req.proxied ? req.proxied_prefix : ''}/ncrs/${req.params.id}`);
      const renderObj = routesUtilities.getRenderObject(req, { ncr });
      return res.render('ncr-concurrence', renderObj);
    } catch (err) {
      logger.error('NCR concurrence view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncrs/:id/approve', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      const isQa = await isQaStaffMember(req.session.userid);
      const renderObj = routesUtilities.getRenderObject(req, { ncr, isQa });
      return res.render('ncr-approval', renderObj);
    } catch (err) {
      logger.error('NCR approval view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncrs/:id/close', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      if (ncr.status !== 'Final Approval') return res.redirect(`${req.proxied ? req.proxied_prefix : ''}/ncrs/${req.params.id}`);
      const renderObj = routesUtilities.getRenderObject(req, { ncr });
      return res.render('ncr-close', renderObj);
    } catch (err) {
      logger.error('NCR close view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncrs/:id/disposition', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      if (ncr.status !== 'Submitted') return res.redirect(`${req.proxied ? req.proxied_prefix : ''}/ncrs/${req.params.id}`);
      const isAssignedCeCs = ncr.ce_cs_id === req.session.userid;
      const renderObj = routesUtilities.getRenderObject(req, { ncr, isAssignedCeCs });
      return res.render('ncr-disposition', renderObj);
    } catch (err) {
      logger.error('NCR disposition view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  // The revision token the NCR page polls every 30 seconds (spec 125 US6): a change
  // in status, in its last update, or in its number of events means the body is stale.
  app.get('/ncrs/:id/live-status', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id, { status: 1, updated_at: 1, events: 1 }).lean();
      if (!ncr) return res.status(404).json({ success: false, message: 'NCR not found' });
      return res.status(200).json({
        ncr_id: String(ncr._id),
        status: ncr.status,
        updated_at: ncr.updated_at || null,
        event_count: (ncr.events || []).length,
      });
    } catch (err) {
      logger.error('NCR live status failed:', err);
      return res.status(500).json({ success: false, message: 'Error loading NCR' });
    }
  });

  // The body of the NCR page, rendered as the page renders it, for the page to swap in
  // place (spec 125 US6). Same access as the page itself; no layout.
  app.get('/ncrs/:id/fragment', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      const isQa = await isQaStaffMember(req.session.userid);
      const renderObj = routesUtilities.getRenderObject(req, { ncr, isQa });
      return res.render('ncr-detail-body', renderObj);
    } catch (err) {
      logger.error('NCR fragment failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncrs/:id', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      const isQa = await isQaStaffMember(req.session.userid);
      const renderObj = routesUtilities.getRenderObject(req, { ncr, isQa });
      return res.render('ncr-detail', renderObj);
    } catch (err) {
      logger.error('NCR detail fetch failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });
};
