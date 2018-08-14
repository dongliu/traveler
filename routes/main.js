var routesUtilities = require('../utilities/routes.js');
var auth = require('../lib/auth');

module.exports = function (app) {
  app.get('/', auth.ensureAuthenticated, function (req, res) {
    console.log(app.locals.orgName);
    res.render('main', routesUtilities.getRenderObject(req, {
      roles: req.session.roles
    }));
  });
};
