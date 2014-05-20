var mongoose = require('mongoose');
var User = mongoose.model('User');

var auth = require('../lib/auth');

var Roles = ['manager', 'admin'];

module.exports = function (app) {

  app.get('/users/', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles == undefined || req.session.roles.indexOf('admin') == -1) {
      return res.send(403, 'only admin allowed');
    } else {
      return res.render('users');
    }
  });

  app.get('/usernames/:name', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      name: req.params.name
    }).lean().exec(function (err, user) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (user) {
        return res.render('user', {
          user: user,
          myRoles: req.session.roles
        });
      } else {
        return res.send(404, req.params.name + ' not found');
      }
    });
  });


  app.post('/users/', auth.ensureAuthenticated, function (req, res) {
    // if (!req.is('json')) {
    //   return res.send(415, 'json request expected.');
    // }

    if (req.session.roles == undefined || req.session.roles.indexOf('admin') == -1) {
      return res.send(403, 'only admin allowed');
    }

    if (!req.body.name) {
      return res.send(400, 'need to know name');
    }

    // check if already in db
    User.findOne({
      name: req.body.name
    }).lean().exec(function (err, user) {
      if (err) {
        return res.send(500, err.msg);
      }
      if (user) {
        var url = req.protocol + '://' + req.get('host') + '/users/' + user._id;
        // res.set('Location', url);
        return res.send(200, 'The user is at ' + url);
      } else {
        addUser(req, res);
      }
    });

  });



  app.get('/users/json', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles == undefined || req.session.roles.indexOf('admin') == -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    User.find().lean().exec(function (err, users) {
      if (err) {
        console.error(err.msg);
        return res.json(500, {
          error: err.msg
        });
      }
      res.json(users);
    });
  });


  app.get('/users/:id', auth.ensureAuthenticated, function (req, res) {
    // if (req.session.roles.indexOf('admin') === -1) {
    //   return res.send(403, "You are not authorized to access this resource. ");
    // }
    User.findOne({
      _id: req.params.id
    }).lean().exec(function (err, user) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (user) {
        return res.render('user', {
          user: user,
          myRoles: req.session.roles
        });
      } else {
        return res.send(404, req.params.id + ' has never logged into the application.');
      }
    });
  });

  app.put('/users/:id', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles == undefined || req.session.roles.indexOf('admin') == -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    if (!req.is('json')) {
      return res.json(415, {
        error: 'json request expected.'
      });
    }
    User.findOneAndUpdate({
      _id: req.params.id
    }, req.body).lean().exec(function (err, user) {
      if (err) {
        console.error(err.msg);
        return res.json(500, {
          error: err.msg
        });
      }
      res.send(204);
    });
  });

  // get from the db not ad
  app.get('/users/:id/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.params.id
    }).lean().exec(function (err, user) {
      if (err) {
        console.error(err.msg);
        return res.json(500, {
          error: err.mesage
        });
      }
      return res.json(user);
    });
  });

  app.get('/users/:id/refresh', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles == undefined || req.session.roles.indexOf('admin') == -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    User.findOne({
      _id: req.params.id
    }).exec(function (err, user) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (user) {
        updateUserProfile(user, res);
      } else {
        return res.send(404, req.params.id + ' is not in the application.');
      }
    });
  });


  // resource /adusers

  app.get('/adusers/:id', auth.ensureAuthenticated, function (req, res) {
    res.json([]);
  });


  app.get('/adusers/:id/photo', auth.ensureAuthenticated, function (req, res) {
    res.send(410);
  });

  app.get('/adusernames', auth.ensureAuthenticated, function (req, res) {
    res.send(410);
  });
};

function updateUserProfile(user, res) {
  var searchFilter = ad.searchFilter.replace('_id', user._id);
  var opts = {
    filter: searchFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    res.send(204);
  });
}
