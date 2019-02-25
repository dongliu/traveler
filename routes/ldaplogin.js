/**
 * Created by djarosz on 10/13/15.
 */
var config = require('../config/config.js');
var auth = require('../lib/auth');
var routesUtilities = require('../utilities/routes.js');

module.exports = function(app) {
  app.get('/ldaplogin/', function(req, res) {
    res.render('ldaplogin', routesUtilities.getRenderObject(req));
  });

  app.post('/ldaplogin/', auth.ensureAuthenticated, function(req, res) {
    res.render(
      'ldaplogin',
      routesUtilities.getRenderObject(req, {
        errorMessage: res.locals.error,
      })
    );
    delete res.locals.error;
  });
};
