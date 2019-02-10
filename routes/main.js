var routesUtilities = require('../utilities/routes.js');
var auth = require('../lib/auth');

module.exports = function(app) {
  app.get('/', auth.ensureAuthenticated, function(req, res) {
    res.render(
      'main',
      routesUtilities.getRenderObject(req, {
        roles: req.session.roles,
      })
    );
  });
};
