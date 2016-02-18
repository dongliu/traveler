var ad = require('../config/ad.json');

var ldapClient = require('../lib/ldap-client');

var mongoose = require('mongoose');
var User = mongoose.model('User');

var auth = require('../lib/auth');
var authConfig = require('../config/config').auth;

var fs = require('fs');
var pending_photo = {};
var options = {
  root: __dirname + '/../userphoto/',
  maxAge: 30 * 24 * 3600 * 1000
};

var Roles = ['manager', 'admin'];

function fetch_photo_from_ad(id) {
  var searchFilter = ad.searchFilter.replace('_id', id);
  var opts = {
    filter: searchFilter,
    attributes: ad.rawAttributes,
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, true, function (err, result) {
    var res_list = pending_photo[id];
    delete pending_photo[id];
    if (err) {
      console.error(err);
      res_list.forEach(function (res) {
        res.send(500, 'ldap error');
      });
    } else {
      if (result.length === 0) {
        res_list.forEach(function (res) {
          res.status(400, id + ' is not found');
        });
      } else if (result.length > 1) {
        res_list.forEach(function (res) {
          res.status(400, id + ' is not unique!');
        });
      } else {
        res_list.forEach(function (res) {
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=' + options.maxAge);
          res.send(result[0].thumbnailPhoto);
        });
        // there is a chance that the file was created but not seen by the current leading request
        if (!fs.existsSync(options.root + id + '.jpg')) {
          fs.writeFile(options.root + id + '.jpg', result[0].thumbnailPhoto, function (err) {
            if (err) {
              console.error(err);
            }
          });
        }
      }
    }
  });
}

function updateUserProfile(user, res) {
  var searchFilter = ad.searchFilter.replace('_id', user._id);
  var opts = {
    filter: searchFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      return res.json(500, err);
    }
    if (result.length === 0) {
      return res.json(500, {
        error: user._id + ' is not found!'
      });
    }
    if (result.length > 1) {
      return res.json(500, {
        error: user._id + ' is not unique!'
      });
    }
    user.update({
      name: result[0].displayName,
      email: result[0].mail,
      office: result[0].physicalDeliveryOfficeName,
      phone: result[0].telephoneNumber,
      mobile: result[0].mobile
    }, function (err) {
      if (err) {
        return res.json(500, err);
      }
      res.send(204);
    });
  });
}


function addUser(req, res) {
  var nameFilter = ad.nameFilter.replace('_name', req.body.name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err.name + ' : ' + err.message);
      return res.json(500, err);
    }

    if (result.length === 0) {
      return res.send(404, req.body.name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, req.body.name + ' is not unique!');
    }
    var roles = [];
    if (req.body.manager) {
      roles.push('manager');
    }
    if (req.body.admin) {
      roles.push('admin');
    }
    var user = new User({
      _id: result[0].sAMAccountName.toLowerCase(),
      name: result[0].displayName,
      email: result[0].mail,
      office: result[0].physicalDeliveryOfficeName,
      phone: result[0].telephoneNumber,
      mobile: result[0].mobile,
      roles: roles
    });

    user.save(function (err, newUser) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }

      // var url = req.protocol + '://' + req.get('host') + '/users/' + newUser._id;
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/users/' + newUser._id;
      res.set('Location', url);
      res.send(201, 'The new user is at <a target="_blank" href="' + url + '">' + url + '</a>');
    });

  });
}

module.exports = function (app) {

  app.get('/users/', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles === undefined || req.session.roles.indexOf('admin') === -1) {
      return res.send(403, 'only admin allowed');
    }
    return res.render('users', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/usernames/:name', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      name: req.params.name
    }).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (user) {
        return res.render('user', {
          user: user,
          myRoles: req.session.roles,
          prefix: req.proxied ? req.proxied_prefix : ''
        });
      }
      return res.send(404, req.params.name + ' not found');
    });
  });


  app.post('/users/', auth.ensureAuthenticated, function (req, res) {

    if (req.session.roles === undefined || req.session.roles.indexOf('admin') === -1) {
      return res.send(403, 'only admin allowed');
    }

    if (!req.body.name) {
      return res.send(400, 'need to know name');
    }

    // check if already in db
    User.findOne({
      name: req.body.name
    }).exec(function (err, user) {
      if (err) {
        return res.send(500, err.message);
      }
      if (user) {
        // var url = req.protocol + '://' + req.get('host') + '/users/' + user._id;
        var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/users/' + user._id;
        return res.send(200, 'The user is at <a target="_blank" href="' + url + '">' + url + '</a>');
      }
      addUser(req, res);
    });

  });



  app.get('/users/json', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles === undefined || req.session.roles.indexOf('admin') === -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    User.find().exec(function (err, users) {
      if (err) {
        console.error(err);
        return res.json(500, {
          error: err.message
        });
      }
      res.json(users);
    });
  });


  app.get('/users/:id', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.params.id
    }).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (user) {
        return res.render('user', {
          user: user,
          myRoles: req.session.roles,
          prefix: req.proxied ? req.proxied_prefix : ''
        });
      }
      return res.send(404, req.params.id + ' has never logged into the application.');
    });
  });

  app.put('/users/:id', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles === undefined || req.session.roles.indexOf('admin') === -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    if (!req.is('json')) {
      return res.json(415, {
        error: 'json request expected.'
      });
    }
    User.findOneAndUpdate({
      _id: req.params.id
    }, req.body).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.json(500, {
          error: err.message
        });
      }
      res.send(204);
    });
  });

  // get from the db not ad
  app.get('/users/:id/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.params.id
    }).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.json(500, {
          error: err.mesage
        });
      }
      return res.json(user);
    });
  });

  app.get('/users/:id/refresh', auth.ensureAuthenticated, function (req, res) {
    if (req.session.roles === undefined || req.session.roles.indexOf('admin') === -1) {
      return res.send(403, "You are not authorized to access this resource. ");
    }
    User.findOne({
      _id: req.params.id
    }).exec(function (err, user) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (user) {
        updateUserProfile(user, res);
      } else {
        return res.send(404, req.params.id + ' is not in the application.');
      }
    });
  });


  // resource /adusers

  app.get('/adusers/', auth.ensureAuthenticated, function (req, res) {
    res.send(200, 'Please provide the user id');
  });

  app.get('/adusers/:id', auth.ensureAuthenticated, function (req, res) {

    var searchFilter = ad.searchFilter.replace('_id', req.params.id);
    var opts = {
      filter: searchFilter,
      attributes: ad.objAttributes,
      scope: 'sub'
    };
    ldapClient.search(ad.searchBase, opts, false, function (err, result) {
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


  app.get('/adusers/:id/photo', auth.ensureAuthenticated, function (req, res) {
    if (fs.existsSync(options.root + req.params.id + '.jpg')) {
      res.sendfile(req.params.id + '.jpg', options);
    } else {
      if (pending_photo[req.params.id]) {
        pending_photo[req.params.id].push(res);
      } else {
        pending_photo[req.params.id] = [res];
        fetch_photo_from_ad(req.params.id);
      }
    }
  });

  app.get('/adusernames', auth.ensureAuthenticated, function (req, res) {
    var query = req.query.term;
    var nameFilter, opts;
    if (query && query.length > 0) {
      nameFilter = ad.nameFilter.replace('_name', query + '*');
    } else {
      nameFilter = ad.nameFilter.replace('_name', '*');
    }
    opts = {
      filter: nameFilter,
      attributes: ['displayName'],
      paged: {
        pageSize: 200
      },
      scope: 'sub'
    };
    ldapClient.search(ad.searchBase, opts, false, function (err, result) {
      if (err) {
        return res.json(500, err);
      }
      if (result.length === 0) {
        return res.json([]);
      }
      return res.json(result);
    });
  });

  app.get('/adgroups', auth.ensureAuthenticated, function (req, res) {
    var query = req.query.term;
    var filter, opts;
    if (query && query.length > 0) {
      if (query[query.length - 1] === '*') {
        filter = ad.groupSearchFilter.replace('_id', query);
      } else {
        filter = ad.groupSearchFilter.replace('_id', query + '*');
      }
    } else {
      filter = ad.groupSearchFilter.replace('_id', '*');
    }
    opts = {
      filter: filter,
      attributes: ad.groupAttributes,
      scope: 'sub'
    };
    ldapClient.search(ad.groupSearchBase, opts, false, function (err, result) {
      if (err) {
        return res.send(500, err.message);
      }
      if (result.length === 0) {
        return res.json([]);
      }
      return res.json(result);
    });
  });
};
