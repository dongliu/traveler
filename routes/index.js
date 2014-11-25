function proxied_address(req) {
  if (req.proxied) {
    return '/3001';
  }
  return '';
}

exports.main = function (req, res) {
  res.render('main', {
    roles: req.session.roles,
    prefix: proxied_address(req)
  });
};

exports.builder = function (req, res) {
  res.render('builder');
};

exports.logout = function (req, res) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        console.error(err);
      }
    });
  }
  res.redirect('https://liud-dev.nscl.msu.edu/cas/logout');
};
