var config = require('../config/config.js');
var authConfig = config.auth;
var routesUtilities = require('../utilities/routes.js');

exports.main = function (req, res) {
  res.render('main', routesUtilities.getRenderObject(req, {
    roles: req.session.roles
  }));
};

exports.logout = function (req, res) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        console.error(err);
      }
    });
  }
  if(authConfig.type === 'cas') {
    if (res.proxied) {
      res.redirect(authConfig.proxied_cas + '/logout');
    } else {
      res.redirect(authConfig.cas + '/logout');
    }
  } else {
    //ldap
    res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/ldaplogin/')
  }
};
