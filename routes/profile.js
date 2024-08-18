/* eslint-disable import/extensions */
const mongoose = require('mongoose');

const User = mongoose.model('User');
const auth = require('../lib/auth');
const config = require('../config/config.js');
const routesUtilities = require('../utilities/routes.js');

module.exports = function(app) {
  app.get('/profile', auth.ensureAuthenticated, function(req, res) {
    // render the profile page
    User.findOne({
      _id: req.session.userid,
    }).exec(function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).send('something is wrong with the DB.');
      }
      return res.render(
        'profile',
        routesUtilities.getRenderObject(req, {
          user,
        })
      );
    });
  });
};
