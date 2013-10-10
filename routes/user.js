var ad = require('../config/ad.json');

var ldapClient = require('../lib/ldap-client');

var mongoose = require('mongoose');
var User = mongoose.model('User');

var auth = require('../lib/auth');

var Roles = ['manage', 'admin'];

module.exports = function(app) {

  app.get('/users', auth.ensureAuthenticated, function(req, res) {
    if (req.query.name) {
      User.findOne({
        name: req.query.name
      }).lean().exec(function(err, user) {
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
          return res.send(404, req.query.name + ' not found');
        }
      });
    } else {
      if (req.session.roles.length !== 0) {
        return res.render('users');
      } else {
        return res.send(403, 'only admin allowed');
      }
    }

  });

  // app.get('/users/new', auth.ensureAuthenticated, function(req, res) {
  //   res.render('user');
  // });

  app.post('/users', auth.ensureAuthenticated, function(req, res) {
    // if (!req.is('json')) {
    //   return res.send(415, 'json request expected.');
    // }

    if (req.session.roles.indexOf('admin') == -1) {
      return res.send(403, 'only admin allowed');
    }

    if (!req.body.name) {
      return res.send(400, 'need to know name');
    }

    // return res.send(200, req.body.name);

    // check if already in db

    User.findOne({
      name: req.body.name
    }).lean().exec(function(err, user) {
      if (err) {
        return res.send(500, err.msg);
      }
      if (user) {
        var url = req.protocol + '://' + req.get('host') + '/users/' + user.id;
        res.set('Location', url);
        return res.send(303, 'The user is at ' + url);
      } else {
        addUser(req, res);
      }
    });

  });



  app.get('/users/json', auth.ensureAuthenticated, function(req, res) {
    if (req.session.roles.length === 0) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    User.find().lean().exec(function(err, users) {
      if (err) {
        console.error(err.msg);
        return res.json(500, {
          error: err.msg
        });
      }
      res.json(users);
    });
  });


  app.get('/users/:id', auth.ensureAuthenticated, function(req, res) {
    // if (req.session.roles.indexOf('admin') === -1) {
    //   return res.send(403, "You are not authorized to access this resource. ");
    // }
    User.findOne({
      id: req.params.id
    }).lean().exec(function(err, user) {
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
        return res.send(404, req.params.id + ' not found');
      }
    });
  });

  app.put('/users/:id', auth.ensureAuthenticated, function(req, res) {
    if (req.session.roles.indexOf('admin') === -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    if (!req.is('json')) {
      return res.json(415, {
        error: 'json request expected.'
      });
    }
    User.findOneAndUpdate({
      id: req.params.id
    }, req.body).lean().exec(function(err, user) {
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
  app.get('/users/:id/json', auth.ensureAuthenticated, function(req, res) {

    User.findOne({
      id: req.params.id
    }).lean().exec(function(err, user) {
      if (err) {
        console.error(err.msg);
        return res.json(500, {
          error: err.mesage
        });
      }
      return res.json(user);
    });
  });



  // resource /adusers

  app.get('/adusers/:id', auth.ensureAuthenticated, function(req, res) {

    var searchFilter = ad.searchFilter.replace('_id', req.params.id);
    var opts = {
      filter: searchFilter,
      attributes: ad.objAttributes,
      scope: 'sub'
    };
    ldapClient.search(ad.searchBase, opts, false, function(err, result) {
      if (err) {
        return res.json(500, err);
      }
      if (result.length === 0) {
        return res.json(500, {
          error: req.params.id + ' is not found!'
        });
      }
      if (result.length > 1) {
        return res.json(500, {
          error: req.params.id + ' is not unique!'
        });
      }

      return res.json(result[0]);
    });

  });


  app.get('/adusers/:id/photo', auth.ensureAuthenticated, function(req, res) {

    var searchFilter = ad.searchFilter.replace('_id', req.params.id);
    var opts = {
      filter: searchFilter,
      attributes: ad.rawAttributes,
      scope: 'sub'
    };
    ldapClient.search(ad.searchBase, opts, true, function(err, result) {
      if (err) {
        return res.json(500, err);
      }
      if (result.length === 0) {
        return res.json(500, {
          error: req.params.id + ' is not found!'
        });
      }
      if (result.length > 1) {
        return res.json(500, {
          error: req.params.id + ' is not unique!'
        });
      }
      res.set('Content-Type', 'image/jpeg');
      return res.send(result[0].thumbnailPhoto);
    });

  });

  app.get('/adusernames', auth.ensureAuthenticated, function(req, res) {
    // var query = req.param('term');
    var query = req.query.term;
    var nameFilter, opts;
    if (query && query.length > 0) {
      nameFilter = ad.nameFilter.replace('_name', query + '*');
      opts = {
        filter: nameFilter,
        attributes: ['displayName'],
        scope: 'sub'
      };
      ldapClient.search(ad.searchBase, opts, false, function(err, result) {
        if (err) {
          return res.json(500, JSON.stringify(err));
        }
        if (result.length === 0) {
          return res.json(500, {
            error: 'Names starting with ' + query + ' are not found!'
          });
        }
        return res.json(result);
      });
    } else {
      return res.json(500, {
        error: 'query term is required.'
      });
    }
  });
};

function addUser(req, res) {
  var nameFilter = ad.nameFilter.replace('_name', req.body.name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function(err, result) {
    if (err) {
      console.err(err.name + ' : ' + err.message);
      return res.json(500, err);
    }

    if (result.length === 0) {
      return res.send(404, req.body.name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, req.body.name + ' is not unique!');
    }

    var user = new User({
      id: result[0].sAMAccountName,
      name: result[0].displayName,
      email: result[0].mail,
      office: result[0].physicalDeliveryOfficeName,
      phone: result[0].telephoneNumber,
      mobile: result[0].mobile
    });

    user.save(function(err, newUser) {
      if (err) {
        console.err(err.msg);
        return res.send(500, err.msg);
      }

      var url = req.protocol + '://' + req.get('host') + '/users/' + newUser.id;
      res.set('Location', url);
      res.send(303, 'The new user is at ' + url);
    });

  });
}