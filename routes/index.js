var authConfig = require('../config/config').auth;

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
  if (res.proxied) {
    res.redirect(authConfig.proxied_cas + '/logout');
  } else {
    res.redirect(authConfig.cas + '/logout');
  }
};
