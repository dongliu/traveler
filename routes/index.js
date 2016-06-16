var authConfig = require('../config/config').auth;

exports.main = function (req, res) {
  // console.log(req.session);
  res.render('main');
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
