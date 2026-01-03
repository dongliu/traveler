var routesUtilities = require('../utilities/routes.js');

/*
 * GET documentation pages
 */
module.exports = function(app) {
  app.get('/docs/', function(req, res) {
    res.render('doc-in-one', routesUtilities.getRenderObject(req));
  });
};
