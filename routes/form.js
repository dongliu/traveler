/*global FormFile: false, TravelerData: false*/
/*jslint es5: true*/

var config = require('../config/config.js');
var ad = config.ad;
var ldapClient = require('../lib/ldap-client');

var auth = require('../lib/auth');
var authConfig = config.auth;

var mongoose = require('mongoose');
var path = require('path');
var sanitize = require('sanitize-caja');
var util = require('util');
var underscore = require('underscore');
var routesUtilities = require('../utilities/routes.js');

var Form = mongoose.model('Form');
var FormFile = mongoose.model('FormFile');
var User = mongoose.model('User');
var Group = mongoose.model('Group');

function addUserFromAD(req, res, form) {
  var name = req.body.name;
  var nameFilter = ad.nameFilter.replace('_name', name);
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
      return res.send(400, name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, name + ' is not unique!');
    }

    var id = result[0].sAMAccountName.toLowerCase();
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    form.sharedWith.addToSet({
      _id: id,
      username: name,
      access: access
    });
    form.save(function (err) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var user = new User({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber,
        mobile: result[0].mobile,
        forms: [form._id]
      });
      user.save(function (err) {
        if (err) {
          console.error(err);
        }
      });
      return res.send(201, 'The user named ' + name + ' was added to the share list.');
    });
  });
}

function addGroupFromAD(req, res, form) {
  var id = req.body.id.toLowerCase();
  var filter = ad.groupSearchFilter.replace('_id', id);
  var opts = {
    filter: filter,
    attributes: ad.groupAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.groupSearchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }

    if (result.length === 0) {
      return res.send(400, id + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, id + ' is not unique!');
    }

    var name = result[0].displayName;
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    form.sharedGroup.addToSet({
      _id: id,
      groupname: name,
      access: access
    });
    form.save(function (err) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var group = new Group({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        forms: [form._id]
      });
      group.save(function (err) {
        if (err) {
          console.error(err);
        }
      });
      return res.send(201, 'The group ' + id + ' was added to the share list.');
    });
  });
}


function canWrite(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return true;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid) && doc.sharedWith.id(req.session.userid).access === 1) {
    return true;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i]) && doc.sharedGroup.id(req.session.memberOf[i]).access === 1) {
        return true;
      }
    }
  }
  return false;
}

function canRead(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return true;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid)) {
    return true;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i])) {
        return true;
      }
    }
  }
  return false;
}

/*****
access := -1 // no access
        | 0  // read
        | 1  // write
*****/
function getAccess(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return 1;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid)) {
    return doc.sharedWith.id(req.session.userid).access;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i]) && doc.sharedGroup.id(req.session.memberOf[i]).access === 1) {
        return 1;
      }
    }
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i])) {
        return 0;
      }
    }
  }
  if (routesUtilities.checkUserRole(req, 'read_all_forms')) {
    return 0;
  }
  return -1;
}

function getSharedWith(sharedWith, name) {
  var i;
  if (sharedWith.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedWith.length; i += 1) {
    if (sharedWith[i].username === name) {
      return i;
    }
  }
  return -1;
}


function getSharedGroup(sharedGroup, id) {
  var i;
  if (sharedGroup.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedGroup.length; i += 1) {
    if (sharedGroup[i]._id === id) {
      return i;
    }
  }
  return -1;
}


function addUser(req, res, form) {
  var name = req.body.name;
  // check local db first then try ad
  User.findOne({
    name: name
  }, function (err, user) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (user) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      form.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      form.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(201, 'The user named ' + name + ' was added to the share list.');
      });
      user.update({
        $addToSet: {
          forms: form._id
        }
      }, function (err) {
        if (err) {
          console.error(err);
        }
      });
    } else {
      addUserFromAD(req, res, form);
    }
  });

}

function addGroup(req, res, form) {
  var id = req.body.id.toLowerCase();
  // check local db first then try ad
  Group.findOne({
    _id: id
  }, function (err, group) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (group) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      form.sharedGroup.addToSet({
        _id: id,
        groupname: group.name,
        access: access
      });
      form.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(201, 'The group ' + id + ' was added to the share list.');
      });
      group.update({
        $addToSet: {
          forms: form._id
        }
      }, function (err) {
        if (err) {
          console.error(err);
        }
      });
    } else {
      addGroupFromAD(req, res, form);
    }
  });

}

function addShare(req, res, form) {

  if (req.params.list === 'users') {
    addUser(req, res, form);
  }

  if (req.params.list === 'groups') {
    addGroup(req, res, form);
  }

}


module.exports = function (app) {

  app.get('/forms/json', auth.ensureAuthenticated, function (req, res) {
    Form.find({
      createdBy: req.session.userid
    }, 'title createdBy createdOn updatedBy updatedOn sharedWith sharedGroup').lean().exec(function (err, forms) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, forms);
    });
  });

  app.get('/allforms/json', auth.ensureAuthenticated, function (req, res) {
    if (routesUtilities.checkUserRole(req, 'read_all_forms')) {
      Form.find({ }, 'title createdBy createdOn updatedBy updatedOn sharedWith sharedGroup').lean().exec(function (err, forms) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, forms);
      });
    } else {
      res.json(200, 'You are not authorized to view all forms.');
    }
  });

  app.get('/sharedforms/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'forms').lean().exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      Form.find({
        _id: {
          $in: me.forms
        }
      }, 'title createdBy createdOn updatedBy updatedOn sharedWith sharedGroup').lean().exec(function (err, forms) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, forms);
      });
    });
  });

  app.get('/groupsharedforms/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'forms').lean().exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var formids = [];
      var i, j;
      // merge the forms arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].forms.length; j += 1) {
          if (formids.indexOf(groups[i].forms[j]) === -1) {
            formids.push(groups[i].forms[j]);
          }
        }
      }
      Form.find({
        _id: {
          $in: formids
        }
      }, 'title createdBy createdOn updatedBy updatedOn sharedWith sharedGroup').lean().exec(function (err, forms) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, forms);
      });
    });
  });

  app.get('/forms/new', auth.ensureAuthenticated, function (req, res) {
    return res.render('newform', routesUtilities.getRenderObject(req));
  });

  app.get('/forms/:id/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }

      var access = getAccess(req, form);

      if (access === -1) {
        return res.send(403, 'you are not authorized to access this resource');
      }

      if (access === 1) {
        return res.render('builder', routesUtilities.getRenderObject(req, {
          id: req.params.id,
          title: form.title,
          html: form.html
        }));
      }

      return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + req.params.id + '/preview');
    });
  });

  app.get('/forms/:id/json', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }

      var access = getAccess(req, form);

      if (access === -1) {
        return res.send(403, 'you are not authorized to access this resource');
      }

      return res.json(200, form);
    });
  });

  app.post('/forms/:id/uploads/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (underscore.isEmpty(req.files)) {
        return res.send(400, 'Expecte One uploaded file');
      }

      if (!req.body.name) {
        return res.send(400, 'Expecte input name');
      }

      var file = new FormFile({
        form: doc._id,
        value: req.files[req.body.name].originalname,
        file: {
          path: req.files[req.body.name].path,
          encoding: req.files[req.body.name].encoding,
          mimetype: req.files[req.body.name].mimetype
        },
        inputType: req.body.type,
        uploadedBy: req.session.userid,
        uploadedOn: Date.now()
      });

      // console.dir(data);
      file.save(function (err, newfile) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/formfiles/' + newfile.id;
        res.set('Location', url);
        return res.send(201, 'The uploaded file is at <a target="_blank" href="' + url + '">' + url + '</a>');
      });
    });
  });

  app.get('/formfiles/:id', auth.ensureAuthenticated, function (req, res) {
    FormFile.findById(req.params.id).lean().exec(function (err, data) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!data) {
        return res.send(410, 'gone');
      }
      if (data.inputType === 'file') {
        res.sendfile(path.resolve(data.file.path));
      } else {
        res.send(500, 'it is not a file');
      }
    });
  });

  app.get('/forms/:id/preview', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }

      var access = getAccess(req, form);

      if (access === -1) {
        return res.send(403, 'you are not authorized to access this resource');
      }

      return res.render('viewer', routesUtilities.getRenderObject(req, {
        id: req.params.id,
        title: form.title,
        html: form.html
      }));
    });
  });

  app.get('/forms/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id).lean().exec(function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.render('share', routesUtilities.getRenderObject(req, {
        type: 'Form',
        id: req.params.id,
        title: form.title
      }));
    });
  });

  app.get('/forms/:id/share/:list/json', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id).lean().exec(function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      if (req.params.list === 'users') {
        return res.json(200, form.sharedWith || []);
      }
      if (req.params.list === 'groups') {
        return res.json(200, form.sharedGroup || []);
      }
      return res.send(400, 'unknown share list.');
    });
  });

  app.post('/forms/:id/share/:list/', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = -2;
      if (req.params.list === 'users') {
        share = getSharedWith(form.sharedWith, req.body.name);
      }
      if (req.params.list === 'groups') {
        share = getSharedGroup(form.sharedGroup, req.body.id);
      }

      if (share === -2) {
        return res.send(400, 'unknown share list.');
      }

      if (share >= 0) {
        return res.send(400, req.body.name || req.body.id + ' is already in the ' + req.params.list + ' list.');
      }

      if (share === -1) {
        // new user
        addShare(req, res, form);
      }
    });
  });

  app.put('/forms/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = form.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = form.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        // change the access
        if (req.body.access && req.body.access === 'write') {
          share.access = 1;
        } else {
          share.access = 0;
        }
        form.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          // check consistency of user's form list
          var Target;
          if (req.params.list === 'users') {
            Target = User;
          }
          if (req.params.list === 'groups') {
            Target = Group;
          }
          Target.findByIdAndUpdate(req.params.shareid, {
            $addToSet: {
              forms: form._id
            }
          }, function (err, target) {
            if (err) {
              console.error(err);
            }
            if (!target) {
              console.error('The user/group ' + req.params.userid + ' is not in the db');
            }
          });
          return res.send(204);
        });
      } else {
        // the user should in the list
        return res.send(400, 'cannot find ' + req.params.shareid + ' in the list.');
      }
    });
  });

  app.delete('/forms/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    Form.findById(req.params.id, function (err, form) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!form) {
        return res.send(410, 'gone');
      }
      if (form.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = form.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = form.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        share.remove();
        form.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          // keep the consistency of user's form list
          var Target;
          if (req.params.list === 'users') {
            Target = User;
          }
          if (req.params.list === 'groups') {
            Target = Group;
          }
          Target.findByIdAndUpdate(req.params.shareid, {
            $pull: {
              forms: form._id
            }
          }, function (err, target) {
            if (err) {
              console.error(err);
            }
            if (!target) {
              console.error('The user/group ' + req.params.shareid + ' is not in the db');
            }
          });
          return res.send(204);
        });
      } else {
        return res.send(400, 'cannot find ' + req.params.shareid + ' in list.');
      }
    });
  });

  app.post('/forms/', auth.ensureAuthenticated, function (req, res) {
    var html;
    if (!!req.body.html) {
      html = sanitize(req.body.html);
    } else {
      html = '';
    }
    routesUtilities.form.createForm(req.body.title, req.session.userid, html, function (err, newform) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + newform.id + '/';

      res.set('Location', url);
      return res.redirect(url);
    });
  });

  app.post('/forms/clone/', auth.ensureAuthenticated, routesUtilities.filterBody('form'), function (req, res) {
    Form.findById(req.body.form, function (err, form) {
      var access = getAccess(req, form);
      if ( access !== -1 ) {
        var clonedForm = new Form({
          title: form.title,
          createdBy: req.session.userid,
          createdOn: Date.now(),
          clonedFrom: form._id,
          sharedWith: [],
          sharedGroup: [],
          html: form.html
        });

        clonedForm.save(function (err, createdForm) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }

          console.log('new form ' + createdForm.id + ' created');

          var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + createdForm.id + '/';
          res.set('Location', url);
          return res.json(201, {
            location: url
          });
        });

      } else {
        return res.send(400, 'you are not authorized to clone this form');
      }
    });
  });

  app.put('/forms/:id/', auth.ensureAuthenticated, function (req, res) {
    if (!req.is('json')) {
      return res.send(415, 'json request expected');
    }
    var form = {};
    if (req.body.hasOwnProperty('html')) {
      form.html = sanitize(req.body.html);
    }
    if (req.body.hasOwnProperty('title')) {
      form.title = req.body.title;
    }

    if (form.hasOwnProperty('html') || form.hasOwnProperty('title')) {
      form.updatedBy = req.session.userid;
      form.updatedOn = Date.now();
    } else {
      return res.send('400', 'no update details found');
    }

    Form.findById(req.params.id, function (err, doc) {
      if (err) {
        console.dir(err);
        return res.send(500, err.message || err.errmsg);
      }
      if (getAccess(req, doc) !== 1) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      doc.update(form, function (err, old) {
        if (err) {
          console.dir(err);
          return res.send(500, err.message || err.errmsg);
        }
        if (old) {
          return res.send(204);
        }
        return res.send(410, 'cannot find form ' + req.params.id);
      });
    });
  });
};
