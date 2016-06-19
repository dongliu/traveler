/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var auth = require('../lib/auth');
var authConfig = require('../config/config').auth;

var mongoose = require('mongoose');
var sanitize = require('sanitize-caja');
var underscore = require('underscore');

var reqUtils = require('../lib/req-utils');
var shareLib = require('../lib/share');

var Form = mongoose.model('Form');
var FormFile = mongoose.model('FormFile');
var User = mongoose.model('User');
var Group = mongoose.model('Group');

module.exports = function (app) {

  app.get('/forms/', auth.ensureAuthenticated, function (req, res) {
    res.render('forms');
  });

  app.get('/forms/json', auth.ensureAuthenticated, function (req, res) {
    Form.find({
      createdBy: req.session.userid,
      archived: {
        $ne: true
      },
      owner: {
        $exists: false
      }
    }, 'title createdBy createdOn updatedBy updatedOn publicAccess sharedWith sharedGroup').exec(function (err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/transferredforms/json', auth.ensureAuthenticated, function (req, res) {
    Form.find({
      owner: req.session.userid,
      archived: {
        $ne: true
      }
    }, 'title createdBy createdOn updatedBy updatedOn transferredOn publicAccess sharedWith sharedGroup').exec(function (err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/sharedforms/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'forms').exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!me) {
        return res.status(400).send('cannot identify the current user');
      }
      Form.find({
        _id: {
          $in: me.forms
        },
        archived: {
          $ne: true
        }
      }, 'title owner updatedBy updatedOn publicAccess sharedWith sharedGroup').exec(function (fErr, forms) {
        if (fErr) {
          console.error(fErr);
          return res.status(500).send(fErr.message);
        }
        res.status(200).json(forms);
      });
    });
  });

  app.get('/groupsharedforms/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'forms').exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      var formids = [];
      var i;
      var j;
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
        },
        archived: {
          $ne: true
        }
      }, 'title owner updatedBy updatedOn publicAccess sharedWith sharedGroup').exec(function (fErr, forms) {
        if (fErr) {
          console.error(fErr);
          return res.status(500).send(fErr.message);
        }
        res.status(200).json(forms);
      });
    });
  });

  app.get('/archivedforms/json', auth.ensureAuthenticated, function (req, res) {
    Form.find({
      createdBy: req.session.userid,
      archived: true
    }, 'title archivedOn sharedWith sharedGroup').exec(function (err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/publicforms/', auth.ensureAuthenticated, function (req, res) {
    res.render('public-forms');
  });

  app.get('/publicforms/json', auth.ensureAuthenticated, function (req, res) {
    Form.find({
      publicAccess: {
        $in: [0, 1]
      },
      archived: {
        $ne: true
      }
    }).exec(function (err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/forms/new', auth.ensureAuthenticated, function (req, res) {
    return res.render('form-new', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/forms/:id/', auth.ensureAuthenticated, reqUtils.exist('id', Form), function (req, res) {
    var form = req[req.params.id];
    var access = reqUtils.getAccess(req, form);

    if (access === -1) {
      return res.status(403).send('you are not authorized to access this resource');
    }

    if (form.archived) {
      return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + req.params.id + '/preview');
    }

    if (access === 1) {
      return res.render('form-builder', {
        id: req.params.id,
        title: form.title,
        html: form.html,
        status: form.status,
        prefix: req.proxied ? req.proxied_prefix : ''
      });
    }

    return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + req.params.id + '/preview');
  });

  app.get('/forms/:id/json', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.canReadMw('id'), function (req, res) {
    return res.status(200).json(req[req.params.id]);
  });

  app.post('/forms/:id/uploads/', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.canReadMw('id'), function (req, res) {
    var doc = req[req.params.id];
    if (underscore.isEmpty(req.files)) {
      return res.status(400).send('Expecte One uploaded file');
    }

    if (!req.body.name) {
      return res.status(400).send('Expecte input name');
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

    file.save(function (saveErr, newfile) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/formfiles/' + newfile.id;
      res.set('Location', url);
      return res.status(201).send('The uploaded file is at <a target="_blank" href="' + url + '">' + url + '</a>');
    });
  });

  app.get('/formfiles/:id', auth.ensureAuthenticated, reqUtils.exist('id', FormFile), function (req, res) {
    var data = req[req.params.id];
    if (data.inputType === 'file') {
      res.sendFile(data.file.path);
    } else {
      res.status(500).send('it is not a file');
    }
  });

  app.get('/forms/:id/preview', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.canReadMw('id'), function (req, res) {
    var form = req[req.params.id];
    return res.render('form-viewer', {
      id: req.params.id,
      title: form.title,
      html: form.html,
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/forms/:id/share/', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), function (req, res) {
    var form = req[req.params.id];
    return res.render('share', {
      type: 'form',
      id: req.params.id,
      title: form.title,
      access: String(form.publicAccess)
    });
  });

  app.put('/forms/:id/share/public', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['access']), function (req, res) {
    var form = req[req.params.id];
    // change the access
    var access = req.body.access;
    if (['-1', '0', '1'].indexOf(access) === -1) {
      return res.status(400).send('not valid value');
    }
    access = Number(access);
    if (form.publicAccess === access) {
      return res.status(204).end();
    }
    form.publicAccess = access;
    form.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).send('public access is set to ' + req.body.access);
    });
  });

  app.get('/forms/:id/share/:list/json', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), function (req, res) {
    var form = req[req.params.id];
    if (req.params.list === 'users') {
      return res.status(200).json(form.sharedWith || []);
    }
    if (req.params.list === 'groups') {
      return res.status(200).json(form.sharedGroup || []);
    }
    return res.status(400).send('unknown share list.');
  });

  app.post('/forms/:id/share/:list/', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), function (req, res) {
    var form = req[req.params.id];
    var share = -2;
    if (req.params.list === 'users') {
      if (req.body.name) {
        share = reqUtils.getSharedWith(form.sharedWith, req.body.name);
      } else {
        return res.status(400).send('user name is empty.');
      }
    }
    if (req.params.list === 'groups') {
      if (req.body.id) {
        share = reqUtils.getSharedGroup(form.sharedGroup, req.body.id);
      } else {
        return res.status(400).send('group id is empty.');
      }
    }

    if (share === -2) {
      return res.status(400).send('unknown share list.');
    }

    if (share >= 0) {
      return res.status(400).send(req.body.name || req.body.id + ' is already in the ' + req.params.list + ' list.');
    }

    if (share === -1) {
      // new user
      shareLib.addShare(req, res, form);
    }
  });

  app.put('/forms/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['access']), function (req, res) {
    var form = req[req.params.id];
    var share;
    if (req.params.list === 'users') {
      share = form.sharedWith.id(req.params.shareid);
    }
    if (req.params.list === 'groups') {
      share = form.sharedGroup.id(req.params.shareid);
    }
    if (!share) {
      return res.status(400).send('cannot find ' + req.params.shareid + ' in the list.');
    }
    // change the access
    if (req.body.access === 'write') {
      share.access = 1;
    } else if (req.body.access === 'read') {
      share.access = 0;
    } else {
      return res.status(400).send('cannot take the access ' + req.body.access);
    }
    form.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
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
      }, function (updateErr, target) {
        if (updateErr) {
          console.error(updateErr);
        }
        if (!target) {
          console.error('The user/group ' + req.params.userid + ' is not in the db');
        }
      });
      return res.status(200).json(share);
    });
  });

  app.delete('/forms/:id/share/:list/:shareid', reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), auth.ensureAuthenticated, function (req, res) {
    var form = req[req.params.id];
    shareLib.removeShare(req, res, form);
  });

  app.post('/forms/', auth.ensureAuthenticated, reqUtils.sanitize('body', ['html']), function (req, res) {
    var form = {};
    if (req.body.html) {
      form.html = req.body.html;
      form.clonedFrom = req.body.id;
    } else {
      form.html = '';
    }
    form.title = req.body.title;
    form.createdBy = req.session.userid;
    form.createdOn = Date.now();
    form.sharedWith = [];
    (new Form(form)).save(function (err, newform) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + newform.id + '/';

      res.set('Location', url);
      return res.status(201).send('You can see the new form at <a href="' + url + '">' + url + '</a>');
    });
  });

  app.post('/forms/:id/clone', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.canReadMw('id'), function (req, res) {
    var doc = req[req.params.id];
    var form = {};
    form.html = sanitize(doc.html);
    form.title = sanitize(doc.title) + ' clone';
    form.createdBy = req.session.userid;
    form.createdOn = Date.now();
    form.clonedFrom = doc._id;
    form.sharedWith = [];

    (new Form(form)).save(function (saveErr, newform) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/forms/' + newform.id + '/';
      res.set('Location', url);
      return res.status(201).send('You can see the new form at <a href="' + url + '">' + url + '</a>');
    });
  });

  app.put('/forms/:id/archived', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['archived']), function (req, res) {
    var doc = req[req.params.id];
    if (doc.archived === req.body.archived) {
      return res.status(204).end();
    }

    doc.archived = req.body.archived;
    if (doc.archived) {
      doc.archivedOn = Date.now();
    }

    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).send('Form ' + req.params.id + ' archived state set to ' + newDoc.archived);
    });
  });

  app.put('/forms/:id/owner', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['name']), function (req, res) {
    var doc = req[req.params.id];
    shareLib.changeOwner(req, res, doc);
  });

  app.put('/forms/:id/', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.canWriteMw('id'), reqUtils.status('id', [0]), reqUtils.filter('body', ['html', 'title']), reqUtils.sanitize('body', ['html', 'title']), function (req, res) {
    if (!req.is('json')) {
      return res.status(415).send('json request expected');
    }
    var doc = req[req.params.id];
    if (req.body.hasOwnProperty('html')) {
      doc.html = req.body.html;
    }
    if (req.body.hasOwnProperty('title')) {
      if (reqUtils.isOwner(req, doc)) {
        doc.title = req.body.title;
      } else {
        req.send(403, 'not authorized to access this resource');
      }
    }

    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.dir(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.json(newDoc);
    });
  });

  app.put('/forms/:id/status', auth.ensureAuthenticated, reqUtils.exist('id', Form), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['status']), reqUtils.hasAll('body', ['status']), function (req, res) {
    var f = req[req.params.id];
    var s = req.body.status;

    if ([0, 0.5, 1, 2].indexOf(s) === -1) {
      return res.status(400).send('invalid status');
    }

    // no change
    if (f.status === s) {
      return res.status(204).end();
    }

    if (s === 0) {
      if ([0.5].indexOf(f.status) === -1) {
        return res.status(400).send('invalid status change');
      } else {
        f.status = s;
      }
    }

    if (s === 0.5) {
      if ([0].indexOf(f.status) === -1) {
        return res.status(400).send('invalid status change');
      } else {
        f.status = s;
      }
    }

    if (s === 1) {
      if ([0.5].indexOf(f.status) === -1) {
        return res.status(400).send('invalid status change');
      } else {
        f.status = s;
      }
    }

    if (s === 2) {
      if ([1].indexOf(f.status) === -1) {
        return res.status(400).send('invalid status change');
      } else {
        f.status = s;
      }
    }

    f.save(function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).send('status updated to ' + s);
    });

  });
};
