const jade = require('jade');

var auth = require('../lib/auth');
var routesUtilities = require('../utilities/routes.js');
const config = require('../config/config.js');
const reqUtils = require('../lib/req-utils');
const { Roles } = require('../lib/role.js');
const rolesHtml = jade.compileFile(`${__dirname}/../views/roles.jade`);

module.exports = function(app) {
  app.get(
    '/admin/',
    auth.ensureAuthenticated,
    reqUtils.requireAdmin(),
    function(req, res) {
      const supportedRoles = Object.keys(config.permission).filter(role =>
        Roles.includes(role)
      );
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
