const auth = require('../lib/auth');
const { Ncr } = require('../model/ncr');
const routesUtilities = require('../utilities/routes');
const logger = require('../lib/loggers').getLogger();

module.exports = function(app) {
  app.get('/ncr/new', auth.ensureAuthenticated, function(req, res) {
    res.render('ncr-create', routesUtilities.getRenderObject(req));
  });

  app.get('/ncr/:id/concurrence', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      if (ncr.status !== 'Dispositioned') return res.redirect(`${req.proxied ? req.proxied_prefix : ''}/ncr/${req.params.id}`);
      const renderObj = routesUtilities.getRenderObject(req, { ncr });
      return res.render('ncr-concurrence', renderObj);
    } catch (err) {
      logger.error('NCR concurrence view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncr/:id/approve', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      const renderObj = routesUtilities.getRenderObject(req, { ncr });
      return res.render('ncr-approval', renderObj);
    } catch (err) {
      logger.error('NCR approval view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncr/:id/disposition', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      if (ncr.status !== 'Submitted') return res.redirect(`${req.proxied ? req.proxied_prefix : ''}/ncr/${req.params.id}`);
      const renderObj = routesUtilities.getRenderObject(req, { ncr });
      return res.render('ncr-disposition', renderObj);
    } catch (err) {
      logger.error('NCR disposition view failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });

  app.get('/ncr/:id', auth.ensureAuthenticated, async function(req, res) {
    try {
      const ncr = await Ncr.findById(req.params.id).lean();
      if (!ncr) return res.status(404).send('NCR not found');
      const renderObj = routesUtilities.getRenderObject(req, { ncr });
      return res.render('ncr-detail', renderObj);
    } catch (err) {
      logger.error('NCR detail fetch failed:', err);
      return res.status(500).send('Error loading NCR');
    }
  });
};
