// authentication and authorization functions
var url = require('url');
var pause = require('pause');


var mongoose = require('mongoose');
var User = mongoose.model('User');

module.exports = {
  ensureAuthenticated: ensureAuthenticated,
  verifyRole: verifyRole
};

function ensureAuthenticated(req, res, next) {
  if (req.session.userid) {
    next();
  } else {
    // if this is ajax call, then force the browser to refresh to the current page
    if (req.xhr) {
      res.send(401, 'xhr cannot be authenticated');
    } else {
      var halt = pause(req);
      req.session.userid = 'demo';
      User.findOne({
        _id: 'demo'
      }).lean().exec(function (err, user) {
        if (err) {
          console.error(err.msg);
          return req.send(500, 'internal error with db');
        }
        if (user) {
          req.session.roles = user.roles;
          req.session.username = user.name;
          User.findByIdAndUpdate(user._id, {
            lastVisitedOn: Date.now()
          }, function (err, update) {
            if (err) {
              console.err(err.message);
              return req.send(500, 'internal error with db');
            }
          });
          if (req.session.landing) {
            return res.redirect(req.session.landing);
          }
          next();
          halt.resume();
        } else {
          // create a new user
          var first = new User({
            _id: 'demo',
            name: 'demo user',
            email: 'demo@demo.com',
            office: 'everywhere',
            phone: '(123) 456-7890',
            mobile: '(123) 456-7890',
            roles: ['admin', 'manager'],
            lastVisitedOn: Date.now()
          });

          first.save(function (err, newUser) {
            if (err) {
              console.err(err.msg);
              return req.send(500, 'internal error with db');
            }
            req.session.roles = ['admin', 'manager'];
            console.info('A new user logs in: ' + newUser.name);
            req.session.username = newUser.name;
            next();
            halt.resume();
          });
        }
      });
    }
  }
}

function verifyRole(role) {
  return function (req, res, next) {
    // console.log(req.session);
    if (req.session.roles) {
      if (req.session.roles.indexOf(role) > -1) {
        next();
      } else {
        res.send(403, "You are not authorized to access this resource. ");
      }
    } else {
      console.log("Cannot find the user's role.");
      res.send(500, "something wrong for the user's session");
    }
  };
}
