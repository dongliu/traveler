const jade = require('jade');

var auth = require('../lib/auth');
var routesUtilities = require('../utilities/routes.js');
const reqUtils = require('../lib/req-utils');
const { getSupportedRoles } = require('../lib/role.js');
const rolesHtml = jade.compileFile(`${__dirname}/../views/roles.jade`);

module.exports = function(app) {
  app.get(
    '/admin/',
    auth.ensureAuthenticated,
    reqUtils.requireAdmin(),
    function(req, res) {
      const supportedRoles = getSupportedRoles();
      return res.render(
        'admin',
        routesUtilities.getRenderObject(req, {
          supportedRoles,
          rolesHtml: rolesHtml({ supportedRoles }),
        })
      );
    }
  );
};
