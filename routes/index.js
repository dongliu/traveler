var config = require('../config/config.js');
var authConfig = config.auth;

exports.main = function (req, res) {
  res.render('main', {
    roles: req.session.roles,
    prefix: req.proxied ? req.proxied_prefix : ''
  });
};

exports.logout = function (req, res) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        console.error(err);
      }
    });
  }
  if(authConfigh.type === 'cas') {
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
