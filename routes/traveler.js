var ad = require('../config/ad.json');
var ldapClient = require('../lib/ldap-client');

var auth = require('../lib/auth');
var mongoose = require('mongoose');
// var sanitize = require('sanitize-caja');
var util = require('util');


var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerComment = mongoose.model('TravelerComment');


module.exports = function(app) {

  app.get('/travelers/json', auth.ensureAuthenticated, function(req, res) {
    Traveler.find({
      createdBy: req.session.userid
    }, 'title description status devices sharedWith createdOn updatedOn updatedBy').lean().exec(function(err, docs) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      res.json(200, docs);
    });
  });


  app.post('/travelers/', auth.ensureAuthenticated, function(req, res) {
    if (!req.body.form) {
      return res.send(400, 'need the form in request');
    }
    Form.findById(req.body.form, function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy == req.session.userid) {
          createTraveler(form, req, res);
        } else {
          return res.send(400, 'You cannot create a traveler based on a form that you do not own');
        }
      } else {
        return res.send(400, 'cannot find the form ' + req.body.form);
      }
    });
  });

  app.get('/travelers/:id/json', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id).lean().exec(function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        return res.json(200, doc);
      } else {
        return res.send(410, 'gone');
      }

    });
  });

  app.get('/travelers/:id/config', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id, 'title description status devices sharedWith createdBy createdOn updatedOn updatedBy').lean().exec(function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        if (doc.createdBy == req.session.userid) {
          return res.render('config', doc);
        } else {
          return res.res(403, 'You are not authorized to access this resource');
        }
      } else {
        return res.send(410, 'gone');
      }

    });
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, filterBody(['title', 'description']), function(req, res) {
    Traveler.findById(req.params.id, function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        for (var k in req.body) {
          if (req.body.hasOwnProperty(k) && req.body[k] != null) {
            doc[k] = req.body[k];
          }
        }
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function(err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          } else {
            return res.send(204);
          }
        });
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, filterBody(['newdevice']), function(req, res) {
    Traveler.findByIdAndUpdate(req.params.id, {
      $addToSet: {
        devices: req.body.newdevice
      },
      $set: {
        updatedBy: req.session.userid,
        updatedOn: Date.now()
      }
    }, function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        res.send(201, 'The device ' + req.body.newdevice + ' was added to the list.');
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, function(req, res) {
    Traveler.findByIdAndUpdate(req.params.id, {
      $pull: {
        devices: req.params.number,
        $set: {
          updatedBy: req.session.userid,
          updatedOn: Date.now()
        }
      }
    }, function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        res.send(204);
      } else {
        return res.send(410, 'gone');
      }
    });
  });


  app.get('/travelers/:id/share/', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id).lean().exec(function(err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (traveler) {
        if (traveler.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        return res.render('share', {
          type: 'Traveler',
          id: req.params.id,
          title: traveler.title
        });
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.get('/travelers/:id/share/json', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id).lean().exec(function(err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (traveler) {
        if (traveler.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        return res.json(200, traveler.sharedWith || []);
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.post('/travelers/:id/share/', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id, function(err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (traveler) {
        if (traveler.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        var share = getSharedWith(traveler.sharedWith, req.param['name']);
        if (share === -1) {
          // new user
          addUser(req, res, traveler);
        } else {
          // the user cannot be changed in this way
          return res.send(400, 'The user named ' + req.param['name'] + ' is already in the list.');
        }
      } else {
        return res.send(410, 'gone');
      }
    });
  });


  app.put('/travelers/:id/share/:userid', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id, function(err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (traveler) {
        if (traveler.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        var share = traveler.sharedWith.id(req.params.userid);
        if (share) {
          // change the access
          if (req.body.access && req.body.access == 'write') {
            share.access = 1;
          } else {
            share.access = 0;
          }
          traveler.save(function(err) {
            if (err) {
              console.error(err.msg);
              return res.send(500, err.msg);
            } else {
              // check consistency of user's traveler list
              User.findOne({
                _id: req.params.userid
              }, function(err, user) {
                if (err) {
                  console.error(err.msg);
                }
                if (user) {
                  user.update({
                    $addToSet: {
                      travelers: traveler._id
                    }
                  }, function(err) {
                    if (err) {
                      console.error(err.msg);
                    }
                  });
                } else {
                  console.error('The user ' + req.params.userid + ' does not in the db');
                }
              });
              return res.send(204);
            }
          });
        } else {
          // the user should in the list
          return res.send(400, 'cannot find the user ' + req.params.userid);
        }
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.delete('/travelers/:id/share/:userid', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id, function(err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (traveler) {
        if (traveler.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        // var share = getSharedWith(traveler.sharedWith, req.params.userid);
        var share = traveler.sharedWith.id(req.params.userid);
        if (share) {
          // traveler.sharedWith.splice(share, 1);
          share.remove();
          traveler.save(function(err) {
            if (err) {
              console.error(err.msg);
              return res.send(500, err.msg);
            } else {
              // keep the consistency of user's traveler list
              User.findOne({
                _id: req.params.userid
              }, function(err, user) {
                if (err) {
                  console.error(err.msg);
                }
                if (user) {
                  user.update({
                    $pull: {
                      travelers: traveler._id
                    }
                  }, function(err) {
                    if (err) {
                      console.error(err.msg);
                    }
                  });
                } else {
                  console.error('The user ' + req.params.userid + ' does not in the db');
                }
              });
              return res.send(204);
            }
          });
        } else {
          return res.send(400, 'no share info found for ' + req.params.userid);
        }
      } else {
        return res.send(410, 'gone');
      }
    });
  });

};

function createTraveler(form, req, res) {
  var traveler = new Traveler({
    title: 'update me',
    description: '',
    devices: [],
    status: 0,
    createdBy: req.session.userid,
    createdOn: Date.now(),
    sharedWith: [],
    referenceForm: form._id,
    forms: [{
      html: form.html
    }],
    data: [],
    comments: []
  });
  traveler.save(function(err, doc) {
    if (err) {
      console.error(err.msg);
      return res.send(500, err.msg);
    }
    console.log('new traveler ' + doc.id + ' created');
    var url = req.protocol + '://' + req.get('host') + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.json(201, {
      location: '/travelers/' + doc.id + '/'
    });
  });
}


function filterBody(strings) {
  return function(req, res, next) {
    var found = false;
    for (var k in req.body) {
      if (strings.indexOf(k) !== -1) {
        found = true;
      } else {
        req.body[k] = null;
      }
    }
    if (found) {
      next();
    } else {
      return res.send(400, 'cannot find required information in body');
    }
  };
}


function getSharedWith(sharedWith, userid) {
  if (sharedWith.length == 0) {
    return -1;
  }
  for (var i = 0; i < sharedWith.length; i += 1) {
    if (sharedWith[i].userid == userid || sharedWith[i].username == userid) {
      return i;
    }
  }
  return -1;
}

function addUser(req, res, doc) {
  var name = req.param('name');

  // check local db first then try ad
  User.findOne({
    name: name
  }, function(err, user) {
    if (err) {
      console.error(err.msg);
      return res.send(500, err.msg);
    }
    if (user) {
      var access = 0;
      if (req.param('access') && req.param('access') == 'write') {
        access = 1;
      }
      doc.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      doc.save(function(err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        } else {
          return res.send(201, 'The user named ' + name + ' was added to the share list.');
        }
      });
      user.update({
        $addToSet: {
          docs: doc._id
        }
      }, function(err) {
        if (err) {
          console.error(err.msg);
        }
      });
    } else {
      addUserFromAD(req, res, doc);
    }
  });
}

function addUserFromAD(req, res, doc) {
  var name = req.param('name');
  var nameFilter = ad.nameFilter.replace('_name', name);
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
      return res.send(404, name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, name + ' is not unique!');
    }

    var id = result[0].sAMAccountName;
    var access = 0;
    if (req.param('access') && req.param('access') == 'write') {
      access = 1;
    }
    doc.sharedWith.addToSet({
      _id: id,
      username: name,
      access: access
    });
    doc.save(function(err) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      } else {
        var user = new User({
          _id: result[0].sAMAccountName,
          name: result[0].displayName,
          email: result[0].mail,
          office: result[0].physicalDeliveryOfficeName,
          phone: result[0].telephoneNumber,
          mobile: result[0].mobile,
          travelers: [doc._id]
        });
        user.save(function(err) {
          if (err) {
            console.dir(user);
            console.dir(err);
            console.error(err.msg);
          }
        });
        return res.send(201, 'The user named ' + name + ' was added to the share list.');
      }
    });
  });
}