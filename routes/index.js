var auth = require('../config/auth.json');

exports.main = function (req, res) {
  console.log(req.session);
  res.render('main', {
    session: req.session,
    prefix: req.proxied ? req.proxied_prefix : ''
  });
};

/*exports.builder = function (req, res) {
  res.render('builder');
};*/

/*exports.login = function (req, res) {

};*/

exports.logout = function (req, res) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        console.error(err);
      }
    });
  }
  if (res.proxied) {
    res.redirect(auth.proxied_cas + '/logout');
  } else {
    res.redirect(auth.cas + '/logout');
  }
};
