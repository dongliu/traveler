/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var ad = require('../config/ad.json');
var ldapClient = require('../lib/ldap-client');

var fs = require('fs');
var auth = require('../lib/auth');
var config = require('../config/config');
var authConfig = config.auth;
var mongoose = require('mongoose');
var underscore = require('underscore');
var cheer = require('cheerio');

var reqUtils = require('../lib/req-utils');
var shareLib = require('../lib/share');

var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerNote = mongoose.model('TravelerNote');

// var request = require('request');

function createTraveler(form, req, res) {
  // update the total input number and finished input number
  var $ = cheer.load(form.html);
  var num = $('input, textarea').length;
  var traveler = new Traveler({
    title: form.title,
    description: '',
    devices: [],
    status: 0,
    createdBy: req.session.userid,
    createdOn: Date.now(),
    sharedWith: [],
    referenceForm: form._id,
    forms: [],
    data: [],
    comments: [],
    totalInput: num,
    finishedInput: 0
  });
  traveler.forms.push({
    html: form.html,
    activatedOn: [Date.now()],
    reference: form._id,
    alias: form.title
  });
  traveler.activeForm = traveler.forms[0]._id;
  traveler.save(function (err, doc) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    console.log('new traveler ' + doc.id + ' created');
    var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.json(201, {
      location: (req.proxied ? req.proxied_prefix : '') + '/travelers/' + doc.id + '/'
    });
  });
}

function cloneTraveler(source, req, res) {
  var traveler = new Traveler({
    title: source.title + ' clone',
    description: source.description,
    devices: [],
    status: 1,
    createdBy: source.createdBy,
    createdOn: Date.now(),
    clonedBy: req.session.userid,
    clonedFrom: source._id,
    sharedWith: source.sharedWith,
    sharedGroup: source.sharedGroup,
    referenceForm: source.referenceForm,
    forms: source.forms,
    activeForm: source.activeForm,
    data: [],
    comments: [],
    totalInput: source.totalInput,
    finishedInput: 0
  });

  traveler.save(function (err, doc) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    console.log('new traveler ' + doc.id + ' created');
    doc.sharedWith.forEach(function (e) {
      User.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (userErr, user) {
        if (userErr) {
          console.error(userErr);
        }
        if (!user) {
          console.error('The user ' + e._id + ' does not in the db');
        }
      });
    });

    doc.sharedGroup.forEach(function (e) {
      Group.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (groupErr, user) {
        if (groupErr) {
          console.error(groupErr);
        }
        if (!user) {
          console.error('The group ' + e._id + ' does not in the db');
        }
      });
    });

    var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.json(201, {
      location: url
    });
  });
}

module.exports = function (app) {

  app.get('/travelers/', auth.ensureAuthenticated, function (req, res) {
    res.render('travelers');
  });

  app.get('/travelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: {
        $ne: true
      },
      owner: {
        $exists: false
      }
    }, 'title description status devices sharedWith sharedGroup publicAccess locations createdOn deadline updatedOn updatedBy manPower finishedInput totalInput').lean().exec(function (err, docs) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, docs);
    });
  });

  app.get('/transferredtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      owner: req.session.userid,
      archived: {
        $ne: true
      }
    }, 'title description status devices sharedWith sharedGroup publicAccess locations createdOn transferredOn deadline updatedOn updatedBy manPower finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, travelers);
    });
  });

  app.get('/sharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'travelers').exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      Traveler.find({
        _id: {
          $in: me.travelers
        },
        archived: {
          $ne: true
        }
      }, 'title description status devices locations createdBy createdOn owner deadline updatedBy updatedOn sharedWith sharedGroup publicAccess manPower finishedInput totalInput').lean().exec(function (tErr, travelers) {
        if (tErr) {
          console.error(tErr);
          return res.send(500, tErr.message);
        }
        return res.json(200, travelers);
      });
    });
  });

  app.get('/groupsharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'travelers').exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var travelerIds = [];
      var i;
      var j;
      // merge the travelers arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].travelers.length; j += 1) {
          if (travelerIds.indexOf(groups[i].travelers[j]) === -1) {
            travelerIds.push(groups[i].travelers[j]);
          }
        }
      }
      Traveler.find({
        _id: {
          $in: travelerIds
        }
      }, 'title description status devices locations createdBy createdOn owner deadline updatedBy updatedOn sharedWith sharedGroup publicAccess manPower finishedInput totalInput').lean().exec(function (tErr, travelers) {
        if (tErr) {
          console.error(tErr);
          return res.send(500, tErr.message);
        }
        res.json(200, travelers);
      });
    });
  });

  app.get('/publictravelers/', auth.ensureAuthenticated, function (req, res) {
    res.render('public-travelers');
  });

  app.get('/publictravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      publicAccess: {
        $in: [0, 1]
      },
      archived: {
        $ne: true
      }
    }).exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, travelers);
    });
  });


  /*  app.get('/currenttravelers/json', auth.ensureAuthenticated, function (req, res) {
      var search = {
        archived: {
          $ne: true
        }
      };
      if (req.query.hasOwnProperty('device')) {
        search.devices = {
          $in: [req.query.device]
        };
      }
      Traveler.find(search, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').lean().exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.json(200, travelers);
      });
    });

    app.get('/currenttravelersinv1/json', auth.ensureAuthenticated, function (req, res) {
      var fullurl = config.legacy_traveler.travelers;
      if (req.query.hasOwnProperty('device')) {
        fullurl = config.legacy_traveler.devices + req.query.device;
      }
      request({
        strictSSL: false,
        url: fullurl
      }).pipe(res);
    });

    app.get('/currenttravelers/', auth.ensureAuthenticated, function (req, res) {
      return res.render('currenttravelers', {
        device: req.query.device || null
      });
    });*/

  app.get('/archivedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    var search = {
      $and: [{
        $or: [{
          createdBy: req.session.userid,
          owner: {
            $exists: false
          }
        }, {
          owner: req.session.userid
        }]
      }, {
        archived: true
      }]
    };
    Traveler.find(search, 'title description status devices locations archivedOn updatedBy updatedOn deadline sharedWith sharedGroup manPower finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, travelers);
    });
  });

  app.post('/travelers/', auth.ensureAuthenticated, reqUtils.filter('body', ['form', 'source']), function (req, res) {
    if (req.body.form) {
      Form.findById(req.body.form, function (err, form) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        if (form) {
          createTraveler(form, req, res);
        } else {
          return res.send(400, 'cannot find the form ' + req.body.form);
        }
      });
    }
    if (req.body.source) {
      Traveler.findById(req.body.source, function (err, traveler) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        if (traveler) {
          // if (traveler.status === 0) {
          //   return res.send(400, 'You cannot clone an initialized traveler.');
          // }
          if (reqUtils.canRead(req, traveler)) {
            cloneTraveler(traveler, req, res);
          } else {
            return res.send(400, 'You cannot clone a traveler that you cannot read.');
          }
        } else {
          return res.send(400, 'cannot find the traveler ' + req.body.source);
        }
      });
    }
  });

  app.get('/travelers/:id/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), function (req, res) {
    var doc = req[req.params.id];
    if (doc.archived) {
      return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
    }

    if (reqUtils.canWrite(req, doc)) {
      return res.render('traveler', {
        isOwner: reqUtils.isOwner(req, doc),
        traveler: doc,
        formHTML: doc.forms.length === 1 ? doc.forms[0].html : doc.forms.id(doc.activeForm).html
      });
    }

    if (reqUtils.canRead(req, doc)) {
      return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
    }

    return res.send(403, 'You are not authorized to access this resource');
  });

  app.get('/travelers/:id/view', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), function (req, res) {
    return res.render('traveler-viewer', {
      traveler: req[req.params.id]
    });
  });

  app.get('/travelers/:id/json', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    return res.json(200, req[req.params.id]);
  });

  app.put('/travelers/:id/archived', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['archived']), function (req, res) {
    var doc = req[req.params.id];
    if (doc.archived === req.body.archived) {
      return res.send(204);
    }

    doc.archived = req.body.archived;

    if (doc.archived) {
      doc.archivedOn = Date.now();
    }

    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(200, 'traveler ' + req.params.id + ' archived state set to ' + newDoc.archived);
    });

  });

  app.put('/travelers/:id/owner', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['name']), function (req, res) {
    var doc = req[req.params.id];
    shareLib.changeOwner(req, res, doc);
  });

  app.get('/travelers/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), function (req, res) {
    var doc = req[req.params.id];
    return res.render('traveler-config', {
      traveler: doc,
      isOwner: reqUtils.isOwner(req, doc)
    });
  });

  app.get('/travelers/:id/formmanager', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function formviewer(req, res) {
    res.render('form-manager', {
      traveler: req[req.params.id]
    });
  });

  // use the form in the request as the active form
  app.post('/travelers/:id/forms/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['html', '_id', 'title']), reqUtils.hasAll('body', ['html', '_id', 'title']), reqUtils.sanitize('body', ['html', 'title']), function addForm(req, res) {
    var doc = req[req.params.id];
    var form = {
      html: req.body.html,
      activatedOn: [Date.now()],
      reference: req.body._id,
      alias: req.body.title
    };

    var $ = cheer.load(form.html);
    var num = $('input, textarea').length;
    doc.forms.push(form);
    doc.activeForm = doc.forms[doc.forms.length - 1]._id;
    doc.totalInput = num;
    doc.save(function saveDoc(e, newDoc) {
      if (e) {
        console.error(e);
        return res.send(500, e.message);
      }
      return res.json(200, newDoc);
    });
  });

  // set active form
  app.put('/travelers/:id/forms/active', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function putActiveForm(req, res) {
    var doc = req[req.params.id];
    var formid = req.body.formid;
    if (!formid) {
      return res.send(400, 'form id unknown');
    }

    var form = doc.forms.id(formid);

    if (!form) {
      return res.send(410, 'form ' + req.body.formid + ' gone');
    }

    doc.activeForm = form._id;
    var $ = cheer.load(form.html);
    var num = $('input, textarea').length;
    form.activatedOn.push(Date.now());
    doc.totalInput = num;
    doc.save(function saveDoc(e, newDoc) {
      if (e) {
        console.error(e);
        return res.send(500, e.message);
      }
      return res.json(200, newDoc);
    });
  });

  // set form alias
  app.put('/travelers/:id/forms/:fid/alias', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['value']), reqUtils.sanitize('body', ['value']), function putFormAlias(req, res) {
    var doc = req[req.params.id];
    var form = doc.forms.id(req.params.fid);
    if (!form) {
      return res.send(410, 'from ' + req.params.fid + ' not found.');
    }

    form.alias = req.body.value;

    doc.save(function saveDoc(e) {
      if (e) {
        console.error(e);
        return res.send(500, e.message);
      }
      return res.send(204);
    });
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['title', 'description', 'deadline']), reqUtils.sanitize('body', ['title', 'description', 'deadline']), function (req, res) {
    var doc = req[req.params.id];
    var k;
    for (k in req.body) {
      if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
        doc[k] = req.body[k];
      }
    }
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      var out = {};
      for (k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
          out[k] = newDoc.get(k);
        }
      }
      return res.json(200, out);
    });
  });

  app.put('/travelers/:id/status', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), function (req, res) {
    var doc = req[req.params.id];

    if ([1, 1.5, 2, 3].indexOf(req.body.status) === -1) {
      return res.send(400, 'invalid status');
    }

    if (doc.status === req.body.status) {
      return res.send(204);
    }

    if (req.body.status !== 1.5 && !reqUtils.isOwner(req, doc)) {
      return res.send(403, 'You are not authorized to change the status. ');
    }

    if (req.body.status === 1) {
      if ([0, 1.5, 3].indexOf(doc.status) !== -1) {
        doc.status = 1;
      } else {
        return res.send(400, 'cannot start to work from the current status. ');
      }
    }

    if (req.body.status === 1.5) {
      if ([1].indexOf(doc.status) !== -1) {
        doc.status = 1.5;
      } else {
        return res.send(400, 'cannot complete from the current status. ');
      }
    }

    if (req.body.status === 2) {
      if ([1, 1.5].indexOf(doc.status) !== -1) {
        doc.status = 2;
      } else {
        return res.send(400, 'cannot complete from the current status. ');
      }
    }

    if (req.body.status === 3) {
      if ([1].indexOf(doc.status) !== -1) {
        doc.status = 3;
      } else {
        return res.send(400, 'cannot freeze from the current status. ');
      }
    }

    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(200, 'status updated to ' + req.body.status);
    });
  });


  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['newdevice']), reqUtils.sanitize('body', ['newdevice']), function (req, res) {
    var newdevice = req.body.newdevice;
    if (!newdevice) {
      return res.send(400, 'the new device name not accepted');
    }
    var doc = req[req.params.id];
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    var added = doc.devices.addToSet(newdevice);
    if (added.length === 0) {
      return res.send(204);
    }
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.json(200, {
        device: newdevice
      });
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), function (req, res) {
    var doc = req[req.params.id];
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.devices.pull(req.params.number);
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(204);
    });
  });

  app.get('/travelers/:id/data/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    var doc = req[req.params.id];
    TravelerData.find({
      _id: {
        $in: doc.data
      }
    }, 'name value inputType inputBy inputOn').exec(function (dataErr, docs) {
      if (dataErr) {
        console.error(dataErr);
        return res.send(500, dataErr.message);
      }
      return res.json(200, docs);
    });
  });

  app.post('/travelers/:id/data/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['name', 'value', 'type']), reqUtils.hasAll('body', ['name', 'value', 'type']), reqUtils.sanitize('body', ['name', 'value', 'type']), function (req, res) {
    var doc = req[req.params.id];
    if (doc.status !== 1) {
      return res.send(400, 'The traveler ' + req.params.id + ' is not active');
    }
    var data = new TravelerData({
      traveler: doc._id,
      name: req.body.name,
      value: req.body.value,
      inputType: req.body.type,
      inputBy: req.session.userid,
      inputOn: Date.now()
    });
    data.save(function (dataErr) {
      if (dataErr) {
        console.error(dataErr);
        return res.send(500, dataErr.message);
      }
      doc.data.push(data._id);
      doc.manPower.addToSet({
        _id: req.session.userid,
        username: req.session.username
      });
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.send(204);
      });
    });
  });

  app.get('/travelers/:id/notes/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    var doc = req[req.params.id];
    TravelerNote.find({
      _id: {
        $in: doc.notes
      }
    }, 'name value inputBy inputOn').exec(function (noteErr, docs) {
      if (noteErr) {
        console.error(noteErr);
        return res.send(500, noteErr.message);
      }
      return res.json(200, docs);
    });
  });

  app.post('/travelers/:id/notes/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['name', 'value']), reqUtils.hasAll('body', ['name', 'value']), reqUtils.sanitize('body', ['name', 'value']), function (req, res) {
    var doc = req[req.params.id];

    // allow add note for all status
    // if (doc.status !== 1) {
    //   return res.send(400, 'The traveler ' + req.params.id + ' is not active');
    // }
    var note = new TravelerNote({
      traveler: doc._id,
      name: req.body.name,
      value: req.body.value,
      inputBy: req.session.userid,
      inputOn: Date.now()
    });
    note.save(function (noteErr) {
      if (noteErr) {
        console.error(noteErr);
        return res.send(500, noteErr.message);
      }
      doc.notes.push(note._id);
      doc.manPower.addToSet({
        _id: req.session.userid,
        username: req.session.username
      });
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.send(204);
      });
    });
  });

  app.put('/travelers/:id/finishedinput', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), function (req, res) {
    var doc = req[req.params.id];
    if (doc.status < 1 || doc.status >= 2) {
      return res.send(400, 'The traveler ' + req.params.id + ' is not active');
    }

    if (!req.body.hasOwnProperty('finishedInput')) {
      return res.send(400, 'need finished input number');
    }

    doc.update({
      finishedInput: req.body.finishedInput
    }, function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(204);
    });
  });

  app.post('/travelers/:id/uploads/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), function (req, res) {
    var doc = req[req.params.id];
    if (doc.status !== 1) {
      return res.send(400, 'The traveler ' + req.params.id + ' is not active');
    }

    if (underscore.isEmpty(req.files)) {
      return res.send(400, 'Expecte One uploaded file');
    }

    var data = new TravelerData({
      traveler: doc._id,
      name: req.body.name,
      value: req.files[req.body.name].originalname,
      file: {
        path: req.files[req.body.name].path,
        encoding: req.files[req.body.name].encoding,
        mimetype: req.files[req.body.name].mimetype
      },
      inputType: req.body.type,
      inputBy: req.session.userid,
      inputOn: Date.now()
    });

    data.save(function (dataErr) {
      if (dataErr) {
        console.error(dataErr);
        return res.send(500, dataErr.message);
      }
      doc.data.push(data._id);
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/data/' + data._id;
        res.set('Location', url);
        return res.json(201, {
          location: url
        });
      });
    });
  });

  app.get('/data/:id', auth.ensureAuthenticated, reqUtils.exist('id', TravelerData), function (req, res) {
    var data = req[req.params.id];
    if (data.inputType === 'file') {
      fs.exists(data.file.path, function (exists) {
        if (exists) {
          return res.sendfile(data.file.path);
        }
        return res.send(410, 'gone');
      });
    } else {
      res.json(200, data);
    }
  });

  app.get('/travelers/:id/share/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function (req, res) {
    var traveler = req[req.params.id];
    return res.render('share', {
      type: 'Traveler',
      id: req.params.id,
      title: traveler.title,
      access: String(traveler.publicAccess)
    });
  });

  app.put('/travelers/:id/share/public', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['access']), function (req, res) {
    var traveler = req[req.params.id];
    // change the access
    var access = req.body.access;
    if (['-1', '0', '1'].indexOf(access) === -1) {
      return res.send(400, 'not valid value');
    }
    access = Number(access);
    if (traveler.publicAccess === access) {
      return res.send(204);
    }
    traveler.publicAccess = access;
    traveler.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(200, 'public access is set to ' + req.body.access);
    });
  });

  app.get('/travelers/:id/share/:list/json', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function (req, res) {
    var traveler = req[req.params.id];
    if (req.params.list === 'users') {
      return res.json(200, traveler.sharedWith || []);
    }
    if (req.params.list === 'groups') {
      return res.json(200, traveler.sharedGroup || []);
    }
    return res.send(400, 'unknown share list.');
  });

  app.post('/travelers/:id/share/:list/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function (req, res) {
    var traveler = req[req.params.id];
    var share = -2;
    if (req.params.list === 'users') {
      if (req.body.name) {
        share = reqUtils.getSharedWith(traveler.sharedWith, req.body.name);
      } else {
        return res.send(400, 'user name is empty.');
      }
    }
    if (req.params.list === 'groups') {
      if (req.body.id) {
        share = reqUtils.getSharedGroup(traveler.sharedGroup, req.body.id);
      } else {
        return res.send(400, 'group id is empty.');
      }
    }

    if (share === -2) {
      return res.send(400, 'unknown share list.');
    }

    if (share >= 0) {
      return res.send(400, req.body.name || req.body.id + ' is already in the ' + req.params.list + ' list.');
    }

    if (share === -1) {
      // new user
      shareLib.addShare(req, res, traveler);
    }
  });

  app.put('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function (req, res) {
    var traveler = req[req.params.id];
    var share;
    if (req.params.list === 'users') {
      share = traveler.sharedWith.id(req.params.shareid);
    }
    if (req.params.list === 'groups') {
      share = traveler.sharedGroup.id(req.params.shareid);
    }
    if (!share) {
      return res.send(400, 'cannot find ' + req.params.shareid + ' in the list.');
    }
    // change the access
    if (req.body.access && req.body.access === 'write') {
      share.access = 1;
    } else {
      share.access = 0;
    }
    traveler.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      // check consistency of user's traveler list
      var Target;
      if (req.params.list === 'users') {
        Target = User;
      }
      if (req.params.list === 'groups') {
        Target = Group;
      }
      Target.findByIdAndUpdate(req.params.shareid, {
        $addToSet: {
          travelers: traveler._id
        }
      }, function (updateErr, target) {
        if (updateErr) {
          console.error(updateErr);
        }
        if (!target) {
          console.error('The user/group ' + req.params.userid + ' is not in the db');
        }
      });
      return res.json(200, share);
    });
  });

  app.delete('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function (req, res) {
    var traveler = req[req.params.id];
    shareLib.removeShare(req, res, traveler);
  });

};
