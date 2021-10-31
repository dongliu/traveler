const auth = require('../lib/auth');
const routesUtilities = require('../utilities/routes');

module.exports = function(app) {
  app.get('/reviews/', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('manager') === -1
    ) {
      return res.status(403).send('only manager allowed');
    }
    return res.render('reviews', routesUtilities.getRenderObject(req));
  });
};
