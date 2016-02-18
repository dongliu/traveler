/*jslint es5: true*/

var ad = require('../config/ad.json');
var ldapClient = require('../lib/ldap-client');

var fs = require('fs');
var auth = require('../lib/auth');
var authConfig = require('../config/auth.json');
var mongoose = require('mongoose');
var underscore = require('underscore');
var cheer = require('cheerio');
var sanitize = require('sanitize-caja');

var reqUtils = require('../lib/reqUtils');
var addShare = require('../lib/share').addShare;

var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerNote = mongoose.model('TravelerNote');

var travelerV1API = 'https://liud-dev:8181/traveler/api.php';
var request = require('request');

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
    doc.sharedWith.forEach(function (e, i, a) {
      User.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (err, user) {
        if (err) {
          console.error(err);
        }
        if (!user) {
          console.error('The user ' + e._id + ' does not in the db');
        }
      });
    });

    doc.sharedGroup.forEach(function (e, i, a) {
      Group.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (err, user) {
        if (err) {
          console.error(err);
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
      owner: {$exists: false}
    }, 'title description status devices sharedWith sharedGroup clonedBy createdOn deadline updatedOn updatedBy manPower finishedInput totalInput').exec(function (err, docs) {
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
    }).exec(function (err, travelers) {
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
      }, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
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
      var i, j;
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
      }, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, travelers);
      });
    });
  });

  app.get('/currenttravelers/json', auth.ensureAuthenticated, function (req, res) {
    // var device = req.query.device;
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
    var fullurl = travelerV1API + '?resource=travelers';
    if (req.query.hasOwnProperty('device')) {
      fullurl = fullurl + '&device=' + req.query.device;
    }
    request({
      strictSSL: false,
      url: fullurl
    }).pipe(res);
  });

  app.get('/currenttravelers/', auth.ensureAuthenticated, function (req, res) {
    return res.render('currenttravelers', {
      device: req.query.device || null
      // prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/archivedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: true
    }, 'title status devices archivedOn updatedBy updatedOn deadline sharedWith sharedGroup finishedInput totalInput').exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, travelers);
    });
  });

  app.post('/travelers/', auth.ensureAuthenticated, reqUtils.filterBody(['form', 'source']), function (req, res) {
    if (req.body.form) {
      Form.findById(req.body.form, function (err, form) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        if (form) {
          // if (form.createdBy === req.session.userid) {
          createTraveler(form, req, res);
          // } else {
          //   return res.send(400, 'You cannot create a traveler based on a form that you do not own.');
          // }
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
          if (traveler.status === 0) {
            return res.send(400, 'You cannot clone an initialized traveler.');
          }
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

  app.get('/travelers/:id/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (doc.archived) {
        return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
      }

      if (reqUtils.canWrite(req, doc)) {
        return res.render('traveler', {
          traveler: doc,
          formHTML: doc.forms.length === 1 ? doc.forms[0].html : doc.forms.id(doc.activeForm).html,
          prefix: req.proxied ? req.proxied_prefix : ''
        });
      }

      if (reqUtils.canRead(req, doc)) {
        return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
      }

      return res.send(403, 'You are not authorized to access this resource');
    });
  });

  app.get('/travelers/:id/view', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      return res.render('travelerviewer', {
        traveler: doc,
        prefix: req.proxied ? req.proxied_prefix : ''
      });
    });
  });

  app.get('/travelers/:id/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canRead(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      return res.json(200, doc);
    });
  });

  app.put('/travelers/:id/archived', auth.ensureAuthenticated, reqUtils.filterBody(['archived']), function (req, res) {
    Traveler.findById(req.params.id, 'createdBy archived').exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (doc.createdBy !== req.session.userid) {
        return res.send(403, 'You are not authorized to access this resource');
      }

      if (doc.archived === req.body.archived) {
        return res.send(204);
      }

      doc.archived = req.body.archived;

      if (doc.archived) {
        doc.archivedOn = Date.now();
      }

      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });

    });
  });

  app.put('/travelers/:id/owner', auth.ensureAuthenticated, reqUtils.filterBody(['name']), function (req, res) {
    Traveler.findById(req.params.id, 'createdBy owner').exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (!reqUtils.isOwner(req, doc)) {
        return res.send(403, 'Only the current owner can transfer the ownership.');
      }

      // get user id from name here
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
          return res.send(500, err.message);
        }

        if (result.length === 0) {
          return res.send(400, name + ' is not found in AD!');
        }

        if (result.length > 1) {
          return res.send(400, name + ' is not unique!');
        }

        var id = result[0].sAMAccountName.toLowerCase();

        if (doc.owner === id) {
          return res.send(204);
        }

        doc.owner = id;
        doc.transferredOn = Date.now();

        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          return res.send(204);
        });
      });
    });
  });

  app.get('/travelers/:id/config', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, 'title description deadline location status devices sharedWith sharedGroup createdBy createdOn updatedOn updatedBy').exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (reqUtils.canWrite(req, doc)) {
        return res.render('config', {
          traveler: doc,
          prefix: req.proxied ? req.proxied_prefix : ''
        });
      }
      return res.send(403, 'You are not authorized to access this resource');
    });
  });

  app.get('/travelers/:id/formmanager', auth.ensureAuthenticated, function formviewer(req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      res.render('form-manager', {
        traveler: doc,
        prefix: req.proxied ? req.proxied_prefix : ''
      });
    });
  });

  // use the form in the request as the active form
  app.post('/travelers/:id/forms/', auth.ensureAuthenticated, reqUtils.filterBodyAll(['html', '_id', 'title']), function addForm(req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }

      var form = {
        html: sanitize(req.body.html),
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
  });


  // set active form
  app.put('/travelers/:id/forms/active', auth.ensureAuthenticated, function putActiveForm(req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'traveler ' + req.params.id + ' gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
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
  });

  // set form alias
  app.put('/travelers/:id/forms/:fid/alias', auth.ensureAuthenticated, function putFormAlias(req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'traveler ' + req.params.id + ' gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
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
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, reqUtils.filterBody(['title', 'description', 'deadline', 'location']), function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      var k;
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      for (k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
          doc[k] = req.body[k];
        }
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.put('/travelers/:id/status', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (req.body.status === 1.5) {
        if (!reqUtils.canWrite(req, doc)) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      } else {
        if (doc.createdBy !== req.session.userid) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      }

      if (req.body.status === 1) {
        if ([0, 1.5, 3].indexOf(doc.status) !== -1) {
          doc.status = 1;
        } else {
          return res.send(400, 'cannot start to work from the current status');
        }
      }

      if (req.body.status === 1.5) {
        if ([1].indexOf(doc.status) !== -1) {
          doc.status = 1.5;
        } else {
          return res.send(400, 'cannot complete from the current status');
        }
      }

      if (req.body.status === 2) {
        if ([1, 1.5].indexOf(doc.status) !== -1) {
          doc.status = 2;
        } else {
          return res.send(400, 'cannot complete from the current status');
        }
      }

      if (req.body.status === 3) {
        if ([1].indexOf(doc.status) !== -1) {
          doc.status = 3;
        } else {
          return res.send(400, 'cannot freeze from the current status');
        }
      }

      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });


  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, reqUtils.filterBody(['newdevice']), function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.devices.addToSet(req.body.newdevice);
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.devices.pull(req.params.number);
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.get('/travelers/:id/data/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canRead(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      TravelerData.find({
        _id: {
          $in: doc.data
        }
      }, 'name value inputType inputBy inputOn').exec(function (err, docs) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.json(200, docs);
      });
    });
  });

  app.post('/travelers/:id/data/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

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
      data.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        doc.data.push(data._id);
        doc.manPower.addToSet(req.session.userid);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          return res.send(204);
        });
      });
    });
  });

  app.get('/travelers/:id/notes/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canRead(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      TravelerNote.find({
        _id: {
          $in: doc.notes
        }
      }, 'name value inputBy inputOn').exec(function (err, docs) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.json(200, docs);
      });
    });
  });

  app.post('/travelers/:id/notes/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

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
      note.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        doc.notes.push(note._id);
        doc.manPower.addToSet(req.session.userid);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          return res.send(204);
        });
      });
    });
  });

  app.put('/travelers/:id/finishedinput', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }

      if (!req.body.hasOwnProperty('finishedInput')) {
        return res.send(400, 'need finished input number');
      }

      doc.update({
        finishedInput: req.body.finishedInput
      }, function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.post('/travelers/:id/uploads/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }

      // console.info(req.files);

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

      // console.dir(data);
      data.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        doc.data.push(data._id);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/data/' + data._id;
          res.set('Location', url);
          return res.json(201, {
            location: url
          });
        });
      });
    });
  });

  app.get('/data/:id', auth.ensureAuthenticated, function (req, res) {
    TravelerData.findById(req.params.id).exec(function (err, data) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!data) {
        return res.send(410, 'gone');
      }
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
  });

  app.get('/travelers/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).exec(function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, traveler)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.render('share', {
        type: 'Traveler',
        id: req.params.id,
        title: traveler.title,
        access: String(traveler.publicAccess)
      });
    });
  });

  app.put('/travelers/:id/share/public', auth.ensureAuthenticated, reqUtils.filterBody(['access']), function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, traveler)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
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
      traveler.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(200, 'public access is set to ' + req.body.access);
      });
    });
  });

  app.get('/travelers/:id/share/:list/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).exec(function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, traveler)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      if (req.params.list === 'users') {
        return res.json(200, traveler.sharedWith || []);
      }
      if (req.params.list === 'groups') {
        return res.json(200, traveler.sharedGroup || []);
      }
      return res.send(400, 'unknown share list.');
    });
  });

  app.post('/travelers/:id/share/:list/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, traveler)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = -2;
      if (req.params.list === 'users') {
        if (!!req.body.name) {
          share = reqUtils.getSharedWith(traveler.sharedWith, req.body.name);
        } else {
          return res.send(400, 'user name is empty.');
        }
      }
      if (req.params.list === 'groups') {
        if (!!req.body.id) {
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
        addShare(req, res, traveler);
      }
    });
  });

  app.put('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, traveler)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = traveler.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = traveler.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        // change the access
        if (req.body.access && req.body.access === 'write') {
          share.access = 1;
        } else {
          share.access = 0;
        }
        traveler.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
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

  app.delete('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, traveler)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = traveler.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = traveler.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        share.remove();
        traveler.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          // keep the consistency of user's traveler list
          var Target;
          if (req.params.list === 'users') {
            Target = User;
          }
          if (req.params.list === 'groups') {
            Target = Group;
          }
          Target.findByIdAndUpdate(req.params.shareid, {
            $pull: {
              travelers: traveler._id
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

};
