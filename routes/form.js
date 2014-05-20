var auth = require('../lib/auth');
var mongoose = require('mongoose');
var sanitize = require('sanitize-caja');
var util = require('util');

var Form = mongoose.model('Form');
var User = mongoose.model('User');

module.exports = function (app) {

  app.get('/forms/json', auth.ensureAuthenticated, function (req, res) {
    Form.find({
      createdBy: req.session.userid
    }, 'title createdBy createdOn updatedBy updatedOn sharedWith').lean().exec(function (err, forms) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      res.json(200, forms);
    });
  });

  app.get('/sharedforms/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'forms').lean().exec(function (err, me) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      Form.find({
        _id: {
          $in: me.forms
        }
      }, 'title createdBy createdOn updatedBy updatedOn sharedWith').lean().exec(function (err, forms) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        res.json(200, forms);
      });
    });
  });


  app.get('/forms/new', auth.ensureAuthenticated, function (req, res) {
    return res.render('builder');
  });

  app.get('/forms/:id/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }

      var access = getAccess(req, form);

      if (access == -1) {
        return res.send(403, 'you are not authorized to access this resource');
      }

      if (access == 1) {
        return res.render('builder', {
          id: req.params.id,
          title: form.title,
          html: form.html
        });
      }

      // return res.render('viewer', {
      //   id: req.params.id,
      //   title: form.title,
      //   html: form.html
      // });
      return res.redirect('forms/' + req.params.id + '/preview');
    });
  });

  app.get('/forms/:id/preview', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }

      var access = getAccess(req, form);

      if (access == -1) {
        return res.send(403, 'you are not authorized to access this resource');
      }

      return res.render('viewer', {
        id: req.params.id,
        title: form.title,
        html: form.html
      });
    });
  });

  app.get('/forms/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id).lean().exec(function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.render('share', {
        type: 'Form',
        id: req.params.id,
        title: form.title
      });
    });
  });

  app.get('/forms/:id/share/json', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id).lean().exec(function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.json(200, form.sharedWith || []);
    });
  });

  app.post('/forms/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = getSharedWith(form.sharedWith, req.param['name']);
      if (share === -1) {
        // new user
        addUser(req, res, form);
      } else {
        // the user cannot be changed in this way
        return res.send(400, 'The user named ' + req.param['name'] + ' is already in the list.');
      }
    });
  });


  app.put('/forms/:id/share/:userid', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = form.sharedWith.id(req.params.userid);
      if (share) {
        // change the access
        if (req.body.access && req.body.access == 'write') {
          share.access = 1;
        } else {
          share.access = 0;
        }
        form.save(function (err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          } else {
            // check consistency of user's form list
            User.findByIdAndUpdate(req.params.userid, {
              $addToSet: {
                forms: form._id
              }
            }, function (err, user) {
              if (err) {
                console.error(err.msg);
              }
              if (!user) {
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
    });
  });

  app.delete('/forms/:id/share/:userid', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = form.sharedWith.id(req.params.userid);
      if (share) {
        share.remove();
        form.save(function (err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          } else {
            // keep the consistency of user's form list
            User.findByIdAndUpdate(req.params.userid, {
              $pull: {
                forms: form._id
              }
            }, function (err, user) {
              if (err) {
                console.error(err.msg);
              }
              if (!user) {
                console.error('The user ' + req.params.userid + ' does not in the db');
              }
            });
            return res.send(204);
          }
        });
      } else {
        return res.send(400, 'no share info found for ' + req.params.userid);
      }
    });
  });

  app.post('/forms/', auth.ensureAuthenticated, function (req, res) {
    if (!req.is('json')) {
      return res.send(415, 'json request expected');
    }
    if (!req.body.html) {
      return res.send(400, 'need html of the form');
    }
    var form = {};
    form.html = sanitize(req.body.html);
    // form.html = req.body.html;
    form.title = req.body.title;
    form.createdBy = req.session.userid;
    form.createdOn = Date.now();
    form.sharedWith = [];
    (new Form(form)).save(function (err, newform) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      var url = req.protocol + '://' + req.get('host') + '/forms/' + newform.id + '/';
      res.set('Location', url);
      return res.json(201, {
        location: '/forms/' + newform.id + '/'
      });
    });
  });

  app.put('/forms/:id/', auth.ensureAuthenticated, function (req, res) {
    if (!req.is('json')) {
      return res.send(415, 'json request expected');
    }
    var form = {};
    if (req.body.html) {
      form.html = sanitize(req.body.html);
    }
    if (req.body.title) {
      form.title = req.body.title;
    }

    if (form.html || form.title) {
      form.updatedBy = req.session.userid;
      form.updatedOn = Date.now();
    } else {
      return res.send('400', 'no update details found');
    }

    Form.findById(req.params.id, function (err, doc) {
      if (err) {
        console.dir(err);
        return res.send(500, err.msg || err.errmsg);
      }
      if (getAccess(req, doc) !== 1) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      doc.update(form, function (err, old) {
        if (err) {
          console.dir(err);
          return res.send(500, err.msg || err.errmsg);
        }
        if (old) {
          return res.send(204);
        } else {
          return res.send(410, 'cannot find form ' + req.params.id);
        }
      });
    });
  });
};


function getSharedWith(sharedWith, name) {
  if (sharedWith.length == 0) {
    return -1;
  }
  for (var i = 0; i < sharedWith.length; i += 1) {
    if (sharedWith[i].username == name) {
      return i;
    }
  }
  return -1;
}

function addUser(req, res, form) {
  var name = req.param('name');

  // check local db first then try ad
  User.findOne({
    name: name
  }, function (err, user) {
    if (err) {
      console.error(err.msg);
      return res.send(500, err.msg);
    }
    if (user) {
      var access = 0;
      if (req.param('access') && req.param('access') == 'write') {
        access = 1;
      }
      form.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      form.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        } else {
          return res.send(201, 'The user named ' + name + ' was added to the share list.');
        }
      });
      user.update({
        $addToSet: {
          forms: form._id
        }
      }, function (err) {
        if (err) {
          console.error(err.msg);
        }
      });
    } else {
      res.send(500, 'cannot find user');
    }
  });
}

function canWrite(req, doc) {
  if (doc.createdBy == req.session.userid) {
    return true;
  }
  if (doc.sharedWith.id(req.session.userid) && doc.sharedWith.id(req.session.userid).access == 1) {
    return true;
  }
  return false;
}

function canRead(req, doc) {
  if (doc.createdBy == req.session.userid) {
    return true;
  }
  if (doc.sharedWith.id(req.session.userid)) {
    return true;
  }
  return false;
}

/*****
access := -1 // no access
        | 0  // read
        | 1  // write
*****/

function getAccess(req, doc) {
  if (doc.createdBy == req.session.userid) {
    return 1;
  }
  if (doc.sharedWith.id(req.session.userid)) {
    return doc.sharedWith.id(req.session.userid).access;
  }
  return -1;
}
