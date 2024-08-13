const jade = require('jade');

var auth = require('../lib/auth');
var routesUtilities = require('../utilities/routes.js');
const config = require('../config/config.js');
const reqUtils = require('../lib/req-utils');
const { Roles } = require('../lib/role.js');
const rolesHtml = jade.compileFile(`${__dirname}/../views/roles.jade`);

module.exports = function(app) {
  app.get('/admin/', auth.ensureAuthenticated, function(req, res) {
    if (
      res.locals.roles === undefined ||
      res.locals.roles.indexOf('admin') === -1
    ) {
      return res.status(403).send('only admin allowed');
    }
  );
};
