var routesUtilities = require('../utilities/routes.js');

/*
 * GET documentation pages
 */
module.exports = function(app) {
  app.get('/docs/', function(req, res) {
    res.render('doc-in-one', routesUtilities.getRenderObject(req));
  });

  app.get('/docs/form-manager', function(req, res) {
    res.render('doc-form-manager', routesUtilities.getRenderObject(req));
  });
};
