var mongoose = require('mongoose');
var User = mongoose.model('User');
var auth = require('../lib/auth');

module.exports = function (app) {
  app.get('/profile', auth.ensureAuthenticated, function (req, res) {
    // render the profile page
    User.findOne({
      _id: req.session.userid
    }).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.send(500, 'something is wrong with the DB.');
      }
      return res.render('profile', {
        user: user,
        prefix: req.proxied ? req.proxied_prefix : ''
      });
    });
  });

  // user update her/his profile. This is a little different from the admin update the user's roles.
  app.put('/profile', auth.ensureAuthenticated, function (req, res) {
    if (!req.is('json')) {
      return res.json(415, {
        error: 'json request expected.'
      });
    }
    User.findOneAndUpdate({
      _id: req.session.userid
    }, {
      subscribe: req.body.subscribe
    }).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.json(500, {
          error: err.message
        });
      }
      return res.send(204);
    });
  });
};
