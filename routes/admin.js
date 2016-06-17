var auth = require('../lib/auth');

module.exports = function (app) {
  app.get('/admin/', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles === undefined || req.session.roles.indexOf('admin') === -1) {
      return res.send(403, 'only admin allowed');
    }
    return res.render('admin');
  });
};
