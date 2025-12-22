const jade = require('jade');

var auth = require('../lib/auth');
var routesUtilities = require('../utilities/routes.js');
const config = require('../config/config.js');

module.exports = function(app) {
  app.get('/admin/', auth.ensureAuthenticated, function(req, res) {
    if (
      res.locals.roles === undefined ||
      res.locals.roles.indexOf('admin') === -1
    ) {
      return res.status(403).send('only admin allowed');
    }
    const supportedRoles = Object.keys(config.permission);
    return res.render(
      'admin',
      routesUtilities.getRenderObject(req, { supportedRoles })
    );
  });
};
