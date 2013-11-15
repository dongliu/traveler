var ad = require('../config/ad.json');
var ldapClient = require('../lib/ldap-client');

var auth = require('../lib/auth');
var mongoose = require('mongoose');
var sanitize = require('sanitize-caja');
var util = require('util');


var Form = mongoose.model('Form');

module.exports = function(app) {

  app.get('/forms/json', auth.ensureAuthenticated, function(req, res) {
    Form.find({
      createdBy: req.session.userid
    }, 'title createdBy createdOn updatedBy updatedOn read write').lean().exec(function(err, forms) {
      if (err) {
        console.error(err.msg);
        res.send(500, err.msg);
      }
      res.json(200, forms);
    });
  });


  app.get('/forms/new', auth.ensureAuthenticated, function(req, res) {
    return res.render('builder');
  });

  app.get('/forms/:id/', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id).lean().exec(function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy == req.session.userid) {
          return res.render('builder', {
            id: req.params.id,
            title: form.title,
            html: form.html
          });
        }

        var share = getSharedWith(form.sharedWith, req.session.userid);

        if (form.sharedWith[share].access === 0) {
          return res.render('viewer', {
            id: req.params.id,
            title: form.title,
            html: form.html
          });
        }

        if (form.sharedWith[share].access === 1) {
          return res.render('builder', {
            id: req.params.id,
            title: form.title,
            html: form.html
          });
        }

        return res.send(403, 'you are not authorized to access this resource');

      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.get('/forms/:id/preview', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id).lean().exec(function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        var share = getSharedWith(form.sharedWith, req.session.userid);
        if (form.createdBy == req.session.userid || share !== -1 ) {
          return res.render('viewer', {
            id: req.params.id,
            title: form.title,
            html: form.html
          });
        }
        return res.send(403, 'you are not authorized to access this resource');
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.get('/forms/:id/share/', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id).lean().exec(function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        return res.render('share', {
          id: req.params.id,
          title: form.title
        });
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.get('/forms/:id/share/json', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id).lean().exec(function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        return res.json(200, form.sharedWith || []);
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.post('/forms/:id/share/', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id, function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
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
      } else {
        return res.send(410, 'gone');
      }
    });
  });


  app.put('/forms/:id/share/:userid', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id, function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        var share = getSharedWith(form.sharedWith, req.params.userid);
        if (share === -1) {
          // new user
          // addUser(req, res, form);
          return res.send(400, 'cannot find the user ' + req.params.userid);
        } else {
          // the user want to change it
          if (req.body.access && req.body.access == 'write') {
            form.sharedWith[share].access = 1;
          } else {
            form.sharedWith[share].access = 0;
          }
          form.save(function(err) {
            if (err) {
              console.error(err.msg);
              return res.send(500, err.msg);
            } else {
              return res.send(204);
            }
          });
        }
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.delete('/forms/:id/share/:userid', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id, function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy !== req.session.userid) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        var share = getSharedWith(form.sharedWith, req.params.userid);
        if (share === -1) {
          return res.send(400, 'no share info found for ' + req.params.userid);
        } else {
          form.sharedWith.splice(share, 1);
          form.save(function(err) {
            if (err) {
              console.error(err.msg);
              return res.send(500, err.msg);
            } else {
              return res.send(204);
            }
          });
        }
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.post('/forms/', auth.ensureAuthenticated, function(req, res) {
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
    (new Form(form)).save(function(err, newform) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      var url = req.protocol + '://' + req.get('host') + '/forms/' + newform.id;
      res.set('Location', url);
      return res.json(201, {
        location: '/forms/' + newform.id
      });
    });
  });

  app.put('/forms/:id', auth.ensureAuthenticated, function(req, res) {
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
    if (req.body.read && util.isArray(req.body.read)) {
      form.read = req.body.read;
    }
    if (req.body.write && util.isArray(req.body.write)) {
      form.write = req.body.write;
    }

    if (form.html || form.title || form.read || form.write) {
      form.updatedBy = req.session.userid;
      form.updatedOn = Date.now();
    } else {
      return res.send('400', 'no update details found');
    }

    Form.findByIdAndUpdate(req.params.id, form, function(err, old) {
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

};


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

function addUser(req, res, form) {
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
    form.sharedWith.push({
      userid: id,
      username: name,
      access: access
    });
    form.save(function(err) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      } else {
        return res.send(201, 'The user named ' + name + ' was added to the share list.');
      }
    });
  });
}