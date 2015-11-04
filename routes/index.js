var configPath = require('../config/config.js').configPath;
var auth = require('../' + configPath + '/auth.json');

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
  if(auth.type === 'cas') {
    if (res.proxied) {
      res.redirect(auth.proxied_cas + '/logout');
    } else {
      res.redirect(auth.cas + '/logout');
    }
  } else {
    //ldap
    res.redirect((req.proxied ? auth.proxied_service : auth.service) + '/ldaplogin/')
  }
};
